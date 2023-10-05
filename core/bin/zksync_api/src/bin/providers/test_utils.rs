use reqwest::{Error, Response};
use serde_json::json;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use super::proxy_utils::HttpClient;

pub(crate) type ResponseGenerator = dyn Fn(&str) -> Result<Response, Error> + Send + Sync;

pub(crate) struct FakeHttpClient {
    called: Arc<AtomicBool>,
    response_generator: Box<ResponseGenerator>,
}

#[derive(Debug, PartialEq, serde::Deserialize)]
pub(crate) struct FakeBody {
    pub(crate) called_url: String,
}

#[async_trait::async_trait]
impl HttpClient for FakeHttpClient {
    async fn get(&self, url: &str) -> Result<Response, Error> {
        self.called.store(true, Ordering::Relaxed);

        (self.response_generator)(url)
    }
}

impl Default for FakeHttpClient {
    fn default() -> Self {
        Self {
            called: Default::default(),
            response_generator: Box::new(|url| {
                let body = json!({ "called_url": url}).to_string();

                Ok(Response::from(hyper::Response::new(hyper::Body::from(
                    body,
                ))))
            }),
        }
    }
}

impl FakeHttpClient {
    pub(crate) fn from_generator(response_generator: Box<ResponseGenerator>) -> Self {
        Self {
            response_generator,
            ..Default::default()
        }
    }

    pub(crate) fn was_called(&self) -> bool {
        self.called.load(Ordering::Relaxed)
    }
}
