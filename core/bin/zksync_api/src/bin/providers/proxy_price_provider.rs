use std::collections::HashMap;
use tokio::sync::Mutex;

use actix_web::{web, HttpRequest, HttpResponse, Scope};
use zksync_api::fee_ticker::CoinGeckoTypes::CoinsListItem;

use super::proxy_utils::{cache_proxy_request, ProxyState, API_PATH, API_URL};

const RIF_TOKEN_TESTNET_ADDRESS: &str = "0x19f64674D8a5b4e652319F5e239EFd3bc969a1FE";

async fn fetch_coins_list(_: web::Data<ProxyState>, _: web::Path<(bool,)>) -> HttpResponse {
    let rootstock_platform: HashMap<String, Option<String>> = vec![(
        "rootstock".to_string(),
        Some(RIF_TOKEN_TESTNET_ADDRESS.to_string()),
    )]
    .into_iter()
    .collect();
    let rif_token = CoinsListItem {
        id: "rif-token".to_string(),
        platforms: Some(rootstock_platform.clone()),
        name: "RIF Token".to_string(),
        symbol: "RIF".to_string(),
    };
    let rbtc = CoinsListItem {
        id: "rootstock".to_string(),
        symbol: "rbtc".to_string(),
        name: "Rootstock RSK".to_string(),
        platforms: Some(rootstock_platform),
    };
    let coin_list: &[CoinsListItem] = &[rif_token, rbtc];

    HttpResponse::Ok().json(coin_list)
}

async fn fetch_market_chart(reqest: HttpRequest) -> HttpResponse {
    let data: &web::Data<ProxyState> = reqest.app_data().unwrap();
    let query = reqest.query_string();
    let path = reqest.path().to_string();
    let forward_url = match query.is_empty() {
        true => reqest.uri().to_string(),
        false => format!("{}{}/{}?{}", API_URL, API_PATH, path, query),
    };

    cache_proxy_request(reqwest::Client::new(), &forward_url, &data.cache).await
}

pub(crate) fn create_price_service() -> Scope {
    let shared_data = web::Data::new(ProxyState {
        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
    });

    web::scope(API_PATH)
        .app_data(web::Data::new(shared_data))
        .route("/coins/list", web::get().to(fetch_coins_list))
        .route(
            "/coins/{coin_id}/market_chart",
            web::get().to(fetch_market_chart),
        )
}

#[cfg(test)]
// test that the fetch_market_chart forwards any path arguments after question mark to the proxy_request
mod fetch_market_chart_tests {
    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn forwards_path_arguments() {
        let proxied_app = test::init_service(
            App::new()
                .data(ProxyState {
                    cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                })
                .route(
                    "/coins/{coin_id}/market_chart",
                    web::get().to(|| async move { HttpResponse::Ok().body("proxied") }),
                ),
        );

        let test_app = test::init_service(
            App::new()
                .data(ProxyState {
                    cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                })
                .route(
                    "/coins/{coin_id}/market_chart",
                    web::get().to(fetch_market_chart),
                ),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/coins/rif-token/market_chart?vs_currency=usd&days=1")
            .to_request();
        let resp = test::call_service(&test_app, req).await;
        assert!(resp.status().is_success());
    }
}
