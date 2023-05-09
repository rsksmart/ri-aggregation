use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use bigdecimal::{BigDecimal, Zero};
use reqwest::{Response, StatusCode};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use zksync_types::{Address, Token};

use crate::fee_ticker::ticker_api::REQUEST_TIMEOUT;

#[async_trait::async_trait]
pub trait TokenWatcher {
    async fn get_token_market_volume(&mut self, token: &Token) -> anyhow::Result<BigDecimal>;
}

#[derive(Serialize, Deserialize, Debug)]
struct CoinTotalVolume {
    usd: BigDecimal,
}

#[derive(Serialize, Deserialize, Debug)]
struct CoinMarketData {
    total_volume: CoinTotalVolume,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
struct CoinGeckoCoinListItem {
    id: String,
    symbol: String,
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct CoinGeckoCoin {
    id: String,
    symbol: String,
    name: String,
    market_data: CoinMarketData,
}

#[derive(Clone)]
pub struct CoinGeckoTokenWatcher {
    client: reqwest::Client,
    addr: String,
    cache: Arc<Mutex<HashMap<Address, BigDecimal>>>,
}

impl CoinGeckoTokenWatcher {
    pub fn new(addr: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            addr,
            cache: Default::default(),
        }
    }
    async fn get_market_volume(&mut self, symbol: &str) -> anyhow::Result<BigDecimal> {
        let start = Instant::now();

        let url = &self.addr;
        let query = format!("{url}/coins/list");

        // Find coin in the list (TODO: move to own fn called from outside)
        let raw_response = self
            .client
            .get(&query)
            .header("accept", "application/json")
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|err| anyhow::format_err!("CoinGecko API request failed: {}", err))?;

        let response_status = raw_response.status();
        let response_text = raw_response.text().await?;

        let coins: Vec<CoinGeckoCoinListItem> =
            serde_json::from_str(&response_text).map_err(|err| {
                anyhow::format_err!(
                    "Error: {} while decoding coin list response with query: {} with status: {}",
                    err,
                    &query,
                    response_status
                )
            })?;

        let coin: CoinGeckoCoinListItem = match coins
            .iter()
            .find(|coin| coin.symbol.to_lowercase().eq(&symbol.to_lowercase()))
        {
            Some(coin_list_item) => coin_list_item.clone(),
            None => {
                anyhow::bail!("No coin with symbol \"{symbol}\" was found");
            }
        };

        // Construct query with coin id
        let query = format!("{url}/coins/{}", coin.id);

        let raw_response = self
            .client
            .get(&query)
            .header("accept", "application/json")
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|err| anyhow::format_err!("CoinGecko API request failed: {}", err))?;

        let response_status = raw_response.status();
        let response_text = raw_response.text().await?;

        let coin_info: CoinGeckoCoin = serde_json::from_str(&response_text).map_err(|err| {
            anyhow::format_err!(
                "Error: {} while decoding coin info response with query: {} \nwith status: {}",
                err,
                &query,
                response_status
            )
        })?;

        metrics::histogram!(
            "ticker.coingecko_watcher.get_market_volume",
            start.elapsed()
        );

        Ok(coin_info.market_data.total_volume.usd)
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
        match self.get_market_volume(&token.symbol).await {
            Ok(amount) => {
                self.update_historical_amount(token.address, amount.clone())
                    .await;
                return Ok(amount);
            }
            Err(err) => {
                println!("Some error happened: {err}");
                vlog::error!("Error in api: {:?}", err);
            }
        }

        if let Some(amount) = self.get_historical_amount(token.address).await {
            return Ok(amount);
        };

        anyhow::bail!("Token amount api is not available right now.")
    }
}
