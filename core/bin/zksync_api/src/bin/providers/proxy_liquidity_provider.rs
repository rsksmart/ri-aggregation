use std::{collections::HashMap, fs::read_to_string, path::Path, str::FromStr};

use actix_web::{web, FromRequest, HttpResponse, Result};
use tokio::sync::Mutex;
use zksync_api::fee_ticker::CoinGeckoTypes::AssetPlatform;
use zksync_config::ETHClientConfig;
use zksync_types::{Address, TokenInfo};
use zksync_utils::remove_prefix;

use super::proxy_utils::{cache_proxy_request, HttpClient, ProxyState, API_PATH, API_URL};

const TESTNET_PLATFORM_ID: &str = "testnet";
const TESTNET_PLATFORM_NAME: &str = "Rootstock Testnet";
const TESTNET_PLATFORM_SHORTNAME: &str = "testnet";
const ROOTSTOCK_PLATFORM_ID: &str = "rootstock";

async fn handle_get_asset_platforms() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(vec![AssetPlatform {
        id: String::from(TESTNET_PLATFORM_ID),
        chain_identifier: Some(ETHClientConfig::from_env().chain_id as i64),
        name: String::from(TESTNET_PLATFORM_NAME),
        shortname: String::from(TESTNET_PLATFORM_SHORTNAME),
    }]))
}

fn load_tokens(path: impl AsRef<Path>) -> Result<Vec<TokenInfo>, serde_json::Error> {
    serde_json::from_str(&read_to_string(path).unwrap())
}

async fn handle_get_coin_contract(reqest: web::HttpRequest) -> HttpResponse {
    let data: &web::Data<AppState> = reqest.app_data().unwrap();
    let path = web::Path::<(String, String)>::extract(&reqest)
        .await
        .unwrap();

    let (_, contract_address) = path.into_inner();
    let testnet_token_address = Address::from_str(remove_prefix(&contract_address)).unwrap();

    let testnet_token = data
        .testnet_tokens
        .iter()
        .find(|token| token.address.eq(&testnet_token_address));
    let mainnet_token = match testnet_token {
        Some(testnet_token) => data.mainnet_tokens.iter().find(|token| {
            let mainnet_symbol = token.symbol.to_uppercase();
            let testnet_symbol = testnet_token.symbol.to_uppercase();

            mainnet_symbol.eq(match testnet_symbol.len().gt(&mainnet_symbol.len()) {
                true => testnet_symbol.trim_start_matches('T'),
                false => &testnet_symbol,
            })
        }),
        None => None,
    };

    let query = reqest.query_string();
    let forward_url = match query.is_empty() {
        true => reqest.uri().to_string(),
        false => format!(
            "{}{}/coins/{}/contract/{}?{}",
            API_URL,
            API_PATH,
            ROOTSTOCK_PLATFORM_ID,
            match mainnet_token {
                Some(token) => token.address,
                None => testnet_token_address,
            },
            query
        ),
    };

    cache_proxy_request(&*data.proxy_client, &forward_url, &data.proxy_state.cache).await
}

struct AppState {
    mainnet_tokens: Vec<TokenInfo>,
    testnet_tokens: Vec<TokenInfo>,
    proxy_state: ProxyState,
    proxy_client: Box<dyn HttpClient>,
}

pub fn config_liquidity_app(cfg: &mut web::ServiceConfig) {
    let shared_data = AppState {
        mainnet_tokens: load_tokens("etc/tokens/mainnet.json").unwrap(),
        testnet_tokens: load_tokens("etc/tokens/testnet.json").unwrap(),
        proxy_state: ProxyState {
            cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
        },
        proxy_client: Box::new(reqwest::Client::new()),
    };
    cfg.app_data(web::Data::new(shared_data));
    cfg.service(web::resource("/asset_platforms").route(web::get().to(handle_get_asset_platforms)));
    cfg.service(
        web::scope("/coins").service(web::scope("/{platform_id}").service(
            web::scope("/contract").service(
                web::resource("/{contract_address}").route(web::get().to(handle_get_coin_contract)),
            ),
        )),
    );
}

#[cfg(test)]
mod handle_get_coin_contract_tests {
    use super::*;
    use crate::providers::test_utils::FakeHttpClient;
    use actix_web::{test, App};
    use zksync_api::fee_ticker::CoinGeckoTypes::{
        ContractSimplified, MarketDataSimplified, TotalVolumeSimplified,
    };

    #[actix_web::test]
    async fn returns_mainnet_token() {
        let testnet_token = TokenInfo {
            address: Address::random(),
            decimals: 0,
            symbol: "tRIF".to_string(),
        };
        let mainnet_token = TokenInfo {
            address: Address::random(),
            decimals: 0,
            symbol: "RIF".to_string(),
        };

        let expected_uri = format!(
            "/coins/{}/contract/{:#x}",
            TESTNET_PLATFORM_ID, testnet_token.address
        );

        let request = test::TestRequest::get().uri(&expected_uri.clone());
        let http_client_stub = FakeHttpClient::from_generator(Box::new(move |url| {
            if url.eq(&expected_uri) {
                let contract = ContractSimplified {
                    liquidity_score: 666.6,
                    market_data: MarketDataSimplified {
                        total_volume: TotalVolumeSimplified { usd: Some(999.9) },
                    },
                };

                return Ok(reqwest::Response::from(hyper::Response::new(
                    hyper::Body::from(serde_json::to_string(&contract).unwrap()),
                )));
            }

            Err(
                reqwest::blocking::Response::from(hyper::Response::new("{}"))
                    .error_for_status()
                    .unwrap_err(),
            )
        }));

        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(AppState {
                    mainnet_tokens: vec![mainnet_token.clone()],
                    testnet_tokens: vec![testnet_token.clone()],
                    proxy_state: ProxyState {
                        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                    },
                    proxy_client: Box::new(http_client_stub),
                })
                .configure(|cfg| {
                    cfg.service(
                        web::scope("/coins").service(
                            web::scope("/{platform_id}").service(
                                web::scope("/contract").service(
                                    web::resource("/{contract_address}")
                                        .route(web::get().to(handle_get_coin_contract)),
                                ),
                            ),
                        ),
                    );
                })
                .service(
                    web::resource("/{contract_address}")
                        .route(web::get().to(handle_get_coin_contract)),
                ),
        )
        .await;

        let response = test::call_service(&test_app, request.to_request()).await;
        assert!(response.status().is_success());

        let body = response.into_body();
        let bytes = actix_web::body::to_bytes(body).await.unwrap();
        let result = String::from_utf8(bytes.to_vec()).unwrap();

        let ContractSimplified {
            liquidity_score,
            market_data,
        } = serde_json::from_str(&result).unwrap();

        assert_eq!(liquidity_score, 666.6);
        assert_eq!(
            market_data,
            MarketDataSimplified {
                total_volume: TotalVolumeSimplified { usd: Some(999.9) }
            }
        );
    }
}
