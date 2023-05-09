use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use bigdecimal::BigDecimal;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use zksync_types::{Address, Token};

use crate::fee_ticker::ticker_api::REQUEST_TIMEOUT;

#[async_trait::async_trait]
pub trait TokenWatcher {
    async fn get_token_market_volume(&mut self, token: &Token) -> anyhow::Result<BigDecimal>;
}

#[derive(Serialize, Deserialize, Debug)]
struct CGTokenTotalVolume {
    usd: BigDecimal,
}

#[derive(Serialize, Deserialize, Debug)]
struct CGTokenMarketData {
    total_volume: CGTokenTotalVolume,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct CGTokenListItem {
    id: String,
    symbol: String,
    name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct CGToken {
    id: String,
    symbol: String,
    name: String,
    market_data: CGTokenMarketData,
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
    async fn find_token_by_symbol(
        &mut self,
        token_symbol: &str,
    ) -> anyhow::Result<CGTokenListItem> {
        let query = format!("{}/coins/list", &self.addr);
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

        let token_list: Vec<CGTokenListItem> =
            serde_json::from_str(&response_text).map_err(|err| {
                anyhow::format_err!(
                    "Error: {} while decoding coin list response with query: {} with status: {}",
                    err,
                    &query,
                    response_status
                )
            })?;

        match token_list
            .iter()
            .find(|coin| coin.symbol.to_lowercase().eq(&token_symbol.to_lowercase()))
        {
            Some(token) => Ok(token.clone()),
            None => Err(anyhow::format_err!(
                "\"{}\" token not found on CoinGecko",
                token_symbol
            )),
        }
    }

    async fn get_market_volume(&mut self, token_id: &str) -> anyhow::Result<BigDecimal> {
        let start = Instant::now();

        let query = format!("{}/coins/{}", &self.addr, token_id);
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

        let token_info: CGToken = serde_json::from_str(&response_text).map_err(|err| {
            anyhow::format_err!(
                "Error: {} while decoding token info response with query: {} \nwith status: {}",
                err,
                &query,
                response_status
            )
        })?;

        metrics::histogram!(
            "ticker.coingecko_watcher.get_market_volume",
            start.elapsed()
        );

        Ok(token_info.market_data.total_volume.usd)
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
        if let Ok(coingecko_coin) = self.find_token_by_symbol(&token.symbol).await {
            match self.get_market_volume(&coingecko_coin.id).await {
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
        }

        if let Some(amount) = self.get_historical_amount(token.address).await {
            return Ok(amount);
        };

        anyhow::bail!("Token amount api is not available right now.")
    }
}
