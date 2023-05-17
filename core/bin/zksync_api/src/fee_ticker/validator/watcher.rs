use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use super::types as CGTypes;
use bigdecimal::{BigDecimal, FromPrimitive};
use serde::de::DeserializeOwned;
use tokio::sync::Mutex;
use zksync_types::{Address, Token};

use crate::fee_ticker::ticker_api::REQUEST_TIMEOUT;

#[async_trait::async_trait]
pub trait TokenWatcher {
    async fn get_token_market_volume(&mut self, token: &Token) -> anyhow::Result<BigDecimal>;
}

#[derive(Clone)]
pub struct CoinGeckoTokenWatcher {
    client: reqwest::Client,
    url: String,
    chain_id: u8,
    cache: Arc<Mutex<HashMap<Address, BigDecimal>>>,
}

impl CoinGeckoTokenWatcher {
    pub fn new(url: String, chain_id: u8) -> Self {
        Self {
            client: reqwest::Client::new(),
            url,
            chain_id,
            cache: Default::default(),
        }
    }

    async fn get<T>(&self, query: &str) -> Result<T, anyhow::Error>
    where
        T: DeserializeOwned,
    {
        let raw_response = self
            .client
            .get(query)
            .header("accept", "application/json")
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|err| anyhow::format_err!("CoinGecko API request failed: {}", err))?;

        let response_status = raw_response.status();
        let response_text = raw_response.text().await.unwrap();

        serde_json::from_str(&response_text).map_err(|err| {
            anyhow::format_err!(
                "Error: {} while decoding response of query: {} with status: {}",
                err,
                &query,
                response_status
            )
        })
    }

    async fn find_platform_for_network(&self) -> anyhow::Result<CGTypes::AssetPlatform> {
        let query = format!("{}/asset_platforms", &self.url);

        let platforms: Vec<CGTypes::AssetPlatform> = self.get(&query).await?;

        match platforms.iter().find(|platform| {
            platform.chain_identifier.is_some()
                && platform.chain_identifier.unwrap() == self.chain_id as i64
        }) {
            Some(platform) => Ok(platform.clone()),
            None => Err(anyhow::format_err!(
                "\"{}\" platform not found on CoinGecko with query {}",
                self.chain_id,
                query
            )),
        }
    }

    async fn get_token_contract(
        &self,
        platform_id: &str,
        contract_address: Address,
    ) -> anyhow::Result<CGTypes::ContractSimplified> {
        let query = format!(
            "{}/coins/{}/contract/{:#x}",
            &self.url, platform_id, contract_address
        );

        self.get(&query).await
    }

    async fn update_historical_amount(&mut self, address: Address, amount: BigDecimal) {
        let mut cache = self.cache.lock().await;
        cache.insert(address, amount);
    }
    async fn get_historical_amount(&mut self, address: Address) -> Option<BigDecimal> {
        let cache = self.cache.lock().await;
        cache.get(&address).cloned()
    }
}

#[async_trait::async_trait]
impl TokenWatcher for CoinGeckoTokenWatcher {
    async fn get_token_market_volume(&mut self, token: &Token) -> anyhow::Result<BigDecimal> {
        let start = Instant::now();
        let stop = || {
            metrics::histogram!(
                "ticker.coingecko_watcher.get_token_market_volume",
                start.elapsed()
            )
        };

        let CGTypes::AssetPlatform {
            id: platform_id, ..
        } = self.find_platform_for_network().await?;
        let contract = self
            .get_token_contract(&platform_id, token.address)
            .await
            .map_err(|err| anyhow::format_err!("CoinGecko error: {}", err))?;
        if let Some(amount) = contract.market_data.total_volume.usd {
            self.update_historical_amount(token.address, BigDecimal::from_f64(amount).unwrap())
                .await;
        }

        if let Some(amount) = self.get_historical_amount(token.address).await {
            stop();

            return Ok(amount);
        };

        stop();
        anyhow::bail!("Token amount api is not available right now.")
    }
}
