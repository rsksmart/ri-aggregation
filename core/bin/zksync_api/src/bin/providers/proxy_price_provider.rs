use std::collections::HashMap;
use tokio::sync::Mutex;

use actix_web::{
    web::{self, Data},
    HttpRequest, HttpResponse, Scope,
};
use zksync_api::fee_ticker::CoinGeckoTypes::CoinsListItem;

use super::proxy_utils::{cache_proxy_request, HttpClient, ProxyState, API_PATH, API_URL};

const RIF_TOKEN_TESTNET_ADDRESS: &str = "0x19f64674D8a5b4e652319F5e239EFd3bc969a1FE";

async fn fetch_coins_list(_: web::Data<AppState>, _: web::Path<(bool,)>) -> HttpResponse {
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

async fn fetch_market_chart(reqest: HttpRequest) -> HttpResponse {
    let data: &web::Data<AppState> = reqest.app_data().unwrap();
    let query = reqest.query_string();
    let path: String = reqest.path().to_string();
    let forward_url = match query.is_empty() {
        true => reqest.uri().to_string(),
        false => format!("{}{}/{}?{}", API_URL, API_PATH, path, query),
    };

    cache_proxy_request(&*data.proxy_client, &forward_url, &data.proxy_state.cache).await
}

struct AppState {
    proxy_state: ProxyState,
    proxy_client: Box<dyn HttpClient>,
}

pub(crate) fn create_price_service() -> Scope {
    let shared_data: Data<AppState> = web::Data::new(AppState {
        proxy_state: ProxyState {
            cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
        },
        proxy_client: Box::new(reqwest::Client::new()),
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
mod fetch_market_chart_tests {
    use crate::providers::test_utils::{FakeBody, FakeHttpClient};

    use super::*;
    use actix_web::{test, App};

    #[actix_web::test]
    async fn changes_url() {
        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(AppState {
                    proxy_state: ProxyState {
                        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                    },
                    proxy_client: Box::<FakeHttpClient>::default(),
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
        let response = test::call_service(&test_app, req).await;
        assert!(response.status().is_success());

        let body_bytes = match response.response().body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => actix_web::web::Bytes::default(),
        };
        let body: FakeBody = serde_json::from_slice(&body_bytes).unwrap();

        assert!(body
            .called_url
            .starts_with(&(API_URL.to_owned() + API_PATH)));
    }

    #[actix_web::test]
    async fn forwards_no_path_arguments() {
        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(AppState {
                    proxy_state: ProxyState {
                        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                    },
                    proxy_client: Box::<FakeHttpClient>::default(),
                })
                .route(
                    "/coins/{coin_id}/market_chart",
                    web::get().to(fetch_market_chart),
                ),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/coins/rif-token/market_chart")
            .to_request();
        let response = test::call_service(&test_app, req).await;
        assert!(response.status().is_success());

        let body_bytes = match response.response().body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => actix_web::web::Bytes::default(),
        };
        let body: FakeBody = serde_json::from_slice(&body_bytes).unwrap();

        assert!(body.called_url.ends_with("/coins/rif-token/market_chart"));
    }

    #[actix_web::test]
    async fn forwards_path_arguments() {
        let test_app = test::init_service(
            #[allow(deprecated)]
            // Allowed deprecated .data function as .app_data is not working inside the test service
            App::new()
                .data(AppState {
                    proxy_state: ProxyState {
                        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                    },
                    proxy_client: Box::<FakeHttpClient>::default(),
                })
                .route(
                    "/coins/{coin_id}/market_chart",
                    web::get().to(fetch_market_chart),
                ),
        )
        .await;
        let expected_arguments = "?vs_currency=usd&days=1";
        let req = test::TestRequest::get()
            .uri(&("/coins/rif-token/market_chart".to_owned() + expected_arguments))
            .to_request();
        let response = test::call_service(&test_app, req).await;
        assert!(response.status().is_success());

        let body_bytes = match response.response().body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => actix_web::web::Bytes::default(),
        };
        let body: FakeBody = serde_json::from_slice(&body_bytes).unwrap();

        assert!(body.called_url.ends_with(expected_arguments));
    }
}

#[cfg(test)]
mod fetch_coins_list_tests {
    use crate::providers::test_utils::FakeHttpClient;

    use super::*;

    #[actix_web::test]
    async fn returns_hardcoded_tokens() {
        let response: HttpResponse = fetch_coins_list(
            web::Data::new(AppState {
                proxy_state: ProxyState {
                    cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
                },
                proxy_client: Box::<FakeHttpClient>::default(),
            }),
            web::Path::from((true,)),
        )
        .await;
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
