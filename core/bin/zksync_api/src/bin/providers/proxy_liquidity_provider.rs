use std::str::FromStr;

use actix_web::{web, FromRequest, HttpResponse, Result, Scope};
use zksync_api::fee_ticker::CoinGeckoTypes::AssetPlatform;
use zksync_config::ETHClientConfig;
use zksync_types::Address;
use zksync_utils::remove_prefix;

use crate::load_tokens;

use super::proxy_utils::{cache_proxy_request, ProxyState, API_PATH, API_URL};

const TESTNET_PLATFORM_ID: &str = "testnet";
const TESTNET_PLATFORM_NAME: &str = "Rootstock Testnet";
const TESTNET_PLATFORM_SHORTNAME: &str = "testnet";
pub(crate) const ROOTSTOCK_PLATFORM_ID: &str = "rootstock";

async fn handle_get_asset_platforms() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(vec![AssetPlatform {
        id: String::from(TESTNET_PLATFORM_ID),
        chain_identifier: Some(ETHClientConfig::from_env().chain_id as i64),
        name: String::from(TESTNET_PLATFORM_NAME),
        shortname: String::from(TESTNET_PLATFORM_SHORTNAME),
    }]))
}

async fn handle_get_coin_contract(request: web::HttpRequest) -> HttpResponse {
    let mainnet_tokens = load_tokens("etc/tokens/mainnet.json").unwrap();
    let testnet_tokens = load_tokens("etc/tokens/testnet.json").unwrap();
    let data: &web::Data<ProxyState> = request.app_data().unwrap();
    let path = web::Path::<(String, String)>::extract(&request)
        .await
        .unwrap();

    let (_, contract_address) = path.into_inner();
    let testnet_token_address = Address::from_str(remove_prefix(&contract_address)).unwrap();

    let testnet_token = testnet_tokens
        .iter()
        .find(|token| token.address.eq(&testnet_token_address));
    let mainnet_token = match testnet_token {
        Some(testnet_token) => mainnet_tokens.iter().find(|token| {
            let mainnet_symbol = token.symbol.to_uppercase();
            let testnet_symbol = testnet_token.symbol.to_uppercase();

            mainnet_symbol.eq(match testnet_symbol.len().gt(&mainnet_symbol.len()) {
                true => testnet_symbol.trim_start_matches('T'),
                false => &testnet_symbol,
            })
        }),
        None => None,
    };

    let query = request.query_string();
    let forward_url = format!(
        "{}{}/coins/{}/contract/{:#x}?{}",
        API_URL,
        API_PATH,
        ROOTSTOCK_PLATFORM_ID,
        match mainnet_token {
            Some(token) => token.address,
            None => testnet_token_address,
        },
        query
    );

    cache_proxy_request(&reqwest::Client::new(), &forward_url, &data.cache).await
}

pub(crate) fn config_liquidity_app() -> Scope {
    web::scope("")
        .service(web::resource("/asset_platforms").route(web::get().to(handle_get_asset_platforms)))
        .service(
            web::scope("/coins").service(
                web::scope("/{platform_id}").service(
                    web::scope("/contract").service(
                        web::resource("/{contract_address}")
                            .route(web::get().to(handle_get_coin_contract)),
                    ),
                ),
            ),
        )
}

#[cfg(test)]
mod handle_get_coin_contract_tests {
    use std::collections::HashMap;

    use super::*;
    use actix_web::{test, App};
    use tokio::sync::Mutex;
    use zksync_api::fee_ticker::CoinGeckoTypes::ContractSimplified;
    use zksync_types::TokenInfo;

    #[actix_web::test]
    async fn returns_mainnet_token() {
        let testnet_token = TokenInfo {
            // Testnet RIF token address
            address: Address::from_str("0x19f64674D8a5b4e652319F5e239EFd3bc969a1FE").unwrap(),
            decimals: 0,
            symbol: "tRIF".to_string(),
        };

        let expected_uri = format!(
            "/coins/{}/contract/{:#x}",
            TESTNET_PLATFORM_ID, testnet_token.address
        );

        let request = test::TestRequest::get().uri(&expected_uri.clone());

        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(ProxyState {
                    cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
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

        assert!(
            liquidity_score > 0.0,
            "Liquidity score is not greater than 0"
        );
        assert!(
            market_data.total_volume.usd.is_some() && market_data.total_volume.usd.unwrap() > 0.0,
            "Total volume in USD is not greater than 0"
        );
    }
}
