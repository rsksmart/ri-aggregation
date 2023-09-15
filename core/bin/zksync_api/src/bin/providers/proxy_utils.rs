use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

use actix_web::HttpResponse;
use serde_json::Value;
use zksync_config::DevTickerConfig;

pub(crate) const API_URL: &str = "https://api.coingecko.com";
pub(crate) const API_PATH: &str = "/api/v3";

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
            // TODO: configure timeout (or use existing one)
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
