use std::{collections::HashMap, fs::read_to_string, path::Path, str::FromStr};

use actix_web::{web, HttpResponse, Result};
use tokio::sync::Mutex;
use zksync_api::fee_ticker::CoinGeckoTypes::AssetPlatform;
use zksync_config::ETHClientConfig;
use zksync_types::{Address, TokenInfo};
use zksync_utils::remove_prefix;

use super::proxy_utils::{proxy_request, ProxyState, API_PATH, API_URL};

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

async fn handle_get_coin_contract(
    path: web::Path<(String, String)>,
    data: web::Data<AppState>,
) -> HttpResponse {
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

    let url = format!(
        "{}{}/coins/{}/market_chart/{}",
        API_URL,
        API_PATH,
        ROOTSTOCK_PLATFORM_ID,
        match mainnet_token {
            Some(token) => token.address,
            None => testnet_token_address,
        },
    );

    proxy_request(&url, &data.proxy_state.cache).await
}

struct AppState {
    mainnet_tokens: Vec<TokenInfo>,
    testnet_tokens: Vec<TokenInfo>,
    proxy_state: ProxyState,
}

pub fn config_liquidity_app(cfg: &mut web::ServiceConfig) {
    let shared_data = AppState {
        mainnet_tokens: load_tokens("etc/tokens/mainnet.json").unwrap(),
        testnet_tokens: load_tokens("etc/tokens/testnet.json").unwrap(),
        proxy_state: ProxyState {
            cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
        },
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
    use actix_web::{test, App};

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
        let test_app = test::init_service(
            App::new()
                .data(AppState {
                    mainnet_tokens: vec![mainnet_token.clone()],
                    testnet_tokens: vec![testnet_token.clone()],
                    proxy_state: ProxyState {
                        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                    },
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
                }), // .service(web::resource("/{contract_address}").route(web::get().to(handle_get_coin_contract))),
        )
        .await;
        println!("token address: {:#x}", testnet_token.address);
        let uri = format!(
            "/coins/{}/contract/{:#x}",
            TESTNET_PLATFORM_ID, testnet_token.address
        );
        let request = test::TestRequest::get().uri(&uri);
        let response = test::call_service(&test_app, request.to_request()).await;

        println!("response: {:#?}", response);

        let body = response.into_body();
        let bytes = actix_web::body::to_bytes(body).await.unwrap();
        let result = String::from_utf8(bytes.to_vec()).unwrap();
        println!("response: {:#?}", result);
        // assert!(response.status().is_success());

        // assert!(result.contains(&mainnet_token.address.to_string()));
    }
}
