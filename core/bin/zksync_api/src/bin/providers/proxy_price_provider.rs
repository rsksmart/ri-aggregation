use std::collections::HashMap;

use actix_web::{
    web::{self},
    HttpRequest, HttpResponse, Scope,
};
use zksync_api::fee_ticker::CoinGeckoTypes::CoinsListItem;

use crate::providers::proxy_liquidity_provider::ROOTSTOCK_PLATFORM_ID;

use super::proxy_utils::{cache_proxy_request, ProxyState, API_PATH, API_URL};

const RIF_TOKEN_TESTNET_ADDRESS: &str = "0x19f64674D8a5b4e652319F5e239EFd3bc969a1FE";

async fn fetch_coins_list() -> HttpResponse {
    let rootstock_platform: HashMap<String, Option<String>> = vec![(
        ROOTSTOCK_PLATFORM_ID.to_string(),
        Some(RIF_TOKEN_TESTNET_ADDRESS.to_string()),
    )]
    .into_iter()
    .collect();
    // TODO: we always return the platforms, instead of checking for the query param `include_platform` to be true
    let rif_token = CoinsListItem {
        id: "rif-token".to_string(),
        platforms: Some(rootstock_platform.clone()),
        name: "RIF Token".to_string(),
        symbol: "TRIF".to_string(),
    };
    let rbtc = CoinsListItem {
        id: "rootstock".to_string(),
        symbol: "TRBTC".to_string(),
        name: "Rootstock RSK".to_string(),
        platforms: Some(rootstock_platform),
    };
    let coin_list: &[CoinsListItem] = &[rif_token, rbtc];

    HttpResponse::Ok().json(coin_list)
}

async fn fetch_market_chart(request: HttpRequest) -> HttpResponse {
    println!("fetch_market_chart started");
    let data: &web::Data<ProxyState> = request.app_data().unwrap();
    let query = request.query_string();
    let path = request.path().to_string();
    let forward_url = format!("{}{}?{}", API_URL, path, query);

    println!("fetch_market_chart, before cache_proxy_request");

    cache_proxy_request(&reqwest::Client::new(), &forward_url, &data.cache).await
}

pub(crate) fn create_price_service() -> Scope {
    web::scope(API_PATH)
        .route("/coins/list", web::get().to(fetch_coins_list))
        .route(
            "/coins/{coin_id}/market_chart",
            web::get().to(fetch_market_chart),
        )
}

#[cfg(test)]
mod fetch_market_chart_tests {

    use super::*;
    use actix_web::{test, App};
    use tokio::sync::Mutex;
    use zksync_api::fee_ticker::CoinGeckoTypes::CoinGeckoMarketChart;

    #[actix_web::test]
    async fn changes_url() {
        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(ProxyState {
                    cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                })
                .route(
                    "/api/v3/coins/{coin_id}/market_chart",
                    web::get().to(fetch_market_chart),
                ),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/api/v3/coins/rif-token/market_chart?vs_currency=usd&days=1")
            .to_request();
        let response = test::call_service(&test_app, req).await;
        println!("{:?}", response);
        assert!(response.status().is_success());
        
        let body = response.into_body();
        let bytes = actix_web::body::to_bytes(body).await.unwrap();
        let result = String::from_utf8(bytes.to_vec()).unwrap();

        let CoinGeckoMarketChart {
            prices,
        } = serde_json::from_str(&result).unwrap();

        assert!(!prices.is_empty(), "No prices returned");
    }

    
}

#[cfg(test)]
mod fetch_coins_list_tests {

    use super::*;

    #[actix_web::test]
    async fn returns_hardcoded_tokens() {
        let response: HttpResponse = fetch_coins_list().await;
        assert!(response.status().is_success());

        let body_bytes = match response.body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => actix_web::web::Bytes::default(),
        };
        let body: Vec<CoinsListItem> = serde_json::from_slice(&body_bytes).unwrap();

        let rif_token = body.iter().find(|coin| coin.id == "rif-token").unwrap();
        let rbtc = body.iter().find(|coin| coin.id == "rootstock").unwrap();

        assert_eq!(body.len(), 2);
        assert_eq!(rif_token.name, "RIF Token");
        assert_eq!(rif_token.symbol, "TRIF");
        assert_eq!(
            rif_token
                .platforms
                .as_ref()
                .unwrap()
                .get("rootstock")
                .unwrap()
                .as_ref()
                .unwrap(),
            RIF_TOKEN_TESTNET_ADDRESS
        );
        assert_eq!(rbtc.name, "Rootstock RSK");
        assert_eq!(rbtc.symbol, "TRBTC");
        assert_eq!(
            rbtc.platforms
                .as_ref()
                .unwrap()
                .get("rootstock")
                .unwrap()
                .as_ref()
                .unwrap(),
            RIF_TOKEN_TESTNET_ADDRESS
        );
    }
}
