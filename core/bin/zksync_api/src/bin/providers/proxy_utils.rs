use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

use actix_web::{web::Json, HttpResponse};
use serde_json::{json, Value};
use zksync_config::DevTickerConfig;

pub(crate) const API_URL: &str = "https://api.coingecko.com"; // TODO: could be eventually added to the config files
pub(crate) const API_PATH: &str = "/api/v3"; // TODO: could be eventually added to the config files

#[derive(Debug)]
pub(crate) struct ResponseCache<T> {
    data: T,
    last_fetched: Instant,
}

#[derive(Clone)]
pub(crate) struct ProxyState {
    pub cache: Arc<Mutex<HashMap<String, ResponseCache<Value>>>>,
}

fn proxy_request_error<T: ToString>(url: &str, err: T) -> HttpResponse {
    HttpResponse::InternalServerError().json(Json(json!({
        "error": format!("Failed to proxy request: {}: {}", url, err.to_string())
    })))
}

#[async_trait::async_trait]
pub trait HttpClient {
    async fn get(&self, url: &str) -> Result<reqwest::Response, reqwest::Error>;
}

#[async_trait::async_trait]
impl HttpClient for reqwest::Client {
    async fn get(&self, url: &str) -> Result<reqwest::Response, reqwest::Error> {
        self.get(url).send().await
    }
}

pub(crate) async fn cache_proxy_request<C: HttpClient + ?Sized>(
    client: &C,
    url: &str,
    cache: &Mutex<HashMap<String, ResponseCache<Value>>>,
) -> HttpResponse {
    // Check cache first
    let mut lock = cache.lock().await;
    if let Some(cached) = lock.get(url) {
        if cached.last_fetched.elapsed()
            < Duration::from_secs(DevTickerConfig::from_env().proxy_cache_timout as u64)
        {
            return HttpResponse::Ok().json(&cached.data);
        }
    }

    // Fetch data if not in cache or stale
    match client.get(url.clone()).await {
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
            Err(err) => proxy_request_error(url, err),
        },
        Err(err) => proxy_request_error(url, err),
    }
}

#[cfg(test)]
mod proxy_request_tests {
    use crate::providers::test_utils::{FakeBody, FakeHttpClient};

    use super::*;
    use actix_web::web::Bytes;

    #[actix_web::test]
    async fn calls_given_url() {
        let expected_url = "test_api_url";
        let stub_client = FakeHttpClient::default();
        let cache = Arc::new(Mutex::new(HashMap::new()));
        let response = cache_proxy_request(&stub_client, expected_url, &cache).await;

        assert!(response.status().is_success());
        assert!(stub_client.was_called());

        let body_bytes = match response.body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => Bytes::default(),
        };
        let body: Result<FakeBody, _> = serde_json::from_slice(&body_bytes);

        assert_eq!(body.unwrap().called_url, expected_url);
    }

    #[actix_web::test]
    async fn caches_response() {
        let fetched_window_start = Instant::now();
        let api_url = "http://some.address";
        let expected_key = api_url;
        let stub_client = FakeHttpClient::default();
        let cache = Arc::new(Mutex::new(HashMap::new()));
        let response = cache_proxy_request(&stub_client, api_url, &cache).await;

        let body_bytes = match response.body() {
            actix_web::body::Body::Bytes(b) => b.clone(),
            _ => Bytes::default(),
        };
        let body: Result<FakeBody, _> = serde_json::from_slice(&body_bytes);

        let fetched_window_end = Instant::now();
        let cache_data = cache.lock().await;

        assert!(cache_data.contains_key(expected_key));

        let cache_data_value = cache_data.get(expected_key);

        assert!(cache_data_value.is_some());

        let ResponseCache { last_fetched, data } = cache_data_value.unwrap();

        assert!(last_fetched.le(&fetched_window_end) && last_fetched.ge(&fetched_window_start));
        assert!(!data.is_null());

        let data = serde_json::from_value::<FakeBody>(data.clone());

        assert_eq!(data.unwrap(), body.unwrap());
    }
}
