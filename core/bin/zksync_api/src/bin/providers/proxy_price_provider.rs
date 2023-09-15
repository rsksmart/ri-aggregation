use std::collections::HashMap;
use tokio::sync::Mutex;

use actix_web::{web, HttpResponse, Scope};
use zksync_api::fee_ticker::CoinGeckoTypes::CoinsListItem;

use super::proxy_utils::{proxy_request, ProxyState, API_PATH, API_URL};

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

async fn fetch_market_chart(
    data: web::Data<ProxyState>,
    path: web::Path<(String,)>,
) -> HttpResponse {
    let (coin_id,) = path.into_inner();
    let url = format!("{}{}/coins/{}/market_chart", API_URL, API_PATH, coin_id);

    proxy_request(&url, &data.cache).await
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
