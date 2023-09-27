use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

use actix_web::HttpResponse;
use serde_json::Value;
use zksync_config::DevTickerConfig;

pub(crate) const API_URL: &str = "https://api.coingecko.com"; // TODO: could be eventually added to the config files
pub(crate) const API_PATH: &str = "/api/v3"; // TODO: could be eventually added to the config files

pub(crate) struct ResponseCache<T> {
    data: T,
    last_fetched: Instant,
}

#[derive(Clone)]
pub(crate) struct ProxyState {
    pub cache: Arc<Mutex<HashMap<String, ResponseCache<Value>>>>,
}

pub(crate) async fn proxy_request(
    url: &str,
    cache: &Mutex<HashMap<String, ResponseCache<Value>>>,
) -> HttpResponse {
    let mut lock = cache.lock().await;

    // Check cache first
    if let Some(cached) = lock.get(url) {
        if cached.last_fetched.elapsed()
            < Duration::from_secs(DevTickerConfig::from_env().proxy_cache_timout as u64)
        {
            return HttpResponse::Ok().json(&cached.data);
        }
    }

    // Fetch data if not in cache or stale
    match reqwest::get(url).await {
        Ok(response) => match response.json::<Value>().await {
            Ok(data) => {
                // Cache the fetched data
                lock.insert(
                    url.to_string(),
                    ResponseCache {
                        data: data.clone(),
                        last_fetched: Instant::now(),
                    },
                );
                HttpResponse::Ok().json(data)
            }
            Err(_) => HttpResponse::InternalServerError().finish(),
        },
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

#[cfg(test)]
mod proxy_request_tests {
    use super::*;
    use actix_web::{body, test, web, App};

    #[actix_web::test]
    async fn calls_given_url() {
        let api_url = "/test_api_url";
        let test_app = test::init_service(App::new().route(
            api_url,
            web::get().to(|| HttpResponse::Ok().json("called given url")),
        ))
        .await;
        let cache = Arc::new(Mutex::new(HashMap::new()));
        let response = proxy_request(api_url, &cache).await;

        assert!(response.status().is_success());
        let body = response.into_body();
        let bytes = body::to_bytes(body).await.unwrap();
        let result = String::from_utf8(bytes.to_vec()).unwrap();

        assert_eq!(result, "called given url");
    }
}
