//! This module contains the definition of the fee token validator,
//! an entity which decides whether certain ERC20 token is suitable for paying fees.

pub mod cache;
pub mod types;
pub mod watcher;

// Built-in uses
use std::{
    collections::HashSet,
    time::{Duration, Instant},
};

use bigdecimal::BigDecimal;
use chrono::Utc;

use itertools::Itertools;
// Workspace uses
use zksync_types::{
    tokens::{Token, TokenLike, TokenMarketVolume},
    Address,
};

// Local uses
use crate::fee_ticker::validator::{cache::TokenCacheWrapper, watcher::TokenWatcher};

use zksync_utils::{big_decimal_to_ratio, ratio_to_big_decimal};

const CRITICAL_NUMBER_OF_ERRORS: u32 = 500;

/// We don't want to send requests to the Internet for every request from users.
/// Market updater periodically updates the values of the token market in the cache  
#[derive(Clone, Debug)]
pub(crate) struct MarketUpdater<W> {
    tokens_cache: TokenCacheWrapper,
    watcher: W,
}

impl<W: TokenWatcher> MarketUpdater<W> {
    pub(crate) fn new(cache: impl Into<TokenCacheWrapper>, watcher: W) -> Self {
        Self {
            tokens_cache: cache.into(),
            watcher,
        }
    }

    async fn update_token(&mut self, token: &Token) -> anyhow::Result<TokenMarketVolume> {
        let amount = self.watcher.get_token_market_volume(token).await?;
        let market = TokenMarketVolume {
            market_volume: big_decimal_to_ratio(&amount).unwrap(),
            last_updated: Utc::now(),
        };

        if let Err(e) = self
            .tokens_cache
            .update_token_market_volume(token.id, market.clone())
            .await
        {
            vlog::error!("Error in updating token market volume {}", e);
        }

        Ok(market)
    }

    pub async fn update_all_tokens(&mut self, tokens: Vec<Token>) -> anyhow::Result<()> {
        let start = Instant::now();
        for token in tokens {
            self.update_token(&token).await?;
        }
        metrics::histogram!("ticker.validator.update_all_tokens", start.elapsed());
        Ok(())
    }

    pub async fn keep_updated(mut self, duration_secs: u64) {
        let mut error_counter = 0;

        // Market volume is not available for these tokens and
        // we don't need it because they're added among the unconditionally_valid_tokens
        let unavailable_market_volume_tokens = ["RDOC", "RBTC", "USDRIF"];
        loop {
            let tokens = self.tokens_cache.get_all_tokens().await;
            let result = match tokens {
                Ok(tokens) => {
                    self.update_all_tokens(
                        tokens
                            .into_iter()
                            .filter(|token| {
                                !unavailable_market_volume_tokens.contains(&token.symbol.to_uppercase().as_str())
                            })
                            .collect_vec(),
                    )
                    .await
                }
                Err(e) => Err(e),
            };

            if let Err(e) = result {
                error_counter += 1;
                vlog::warn!("Error when updating token market volume {:?}", e);
                if error_counter >= CRITICAL_NUMBER_OF_ERRORS {
                    vlog::error!(
                        "Critical number of error were produced when updating tokens market"
                    );
                }
            }
            tokio::time::sleep(Duration::from_secs(duration_secs)).await
        }
    }
}

/// Fee token validator decides whether certain ERC20 token is suitable for paying fees.
#[derive(Debug, Clone)]
pub struct FeeTokenValidator {
    // Storage for unconditionally valid tokens, such as RBTC
    unconditionally_valid: HashSet<Address>,
    tokens_cache: TokenCacheWrapper,
    available_time: chrono::Duration,
    liquidity_volume: BigDecimal,
}

impl FeeTokenValidator {
    pub(crate) fn new(
        cache: impl Into<TokenCacheWrapper>,
        available_time: chrono::Duration,
        liquidity_volume: BigDecimal,
        unconditionally_valid: HashSet<Address>,
    ) -> Self {
        Self {
            unconditionally_valid,
            tokens_cache: cache.into(),
            available_time,
            liquidity_volume,
        }
    }

    /// Returns `true` if token can be used to pay fees.
    pub(crate) async fn token_allowed(&self, token: TokenLike) -> anyhow::Result<bool> {
        let token = self.resolve_token(token).await?;
        if let Some(token) = token {
            if self.unconditionally_valid.contains(&token.address) {
                return Ok(true);
            }
            self.check_token(token).await
        } else {
            // Unknown tokens aren't suitable for our needs, obviously.
            Ok(false)
        }
    }

    async fn resolve_token(&self, token: TokenLike) -> anyhow::Result<Option<Token>> {
        self.tokens_cache.get_token(token).await
    }

    async fn check_token(&self, token: Token) -> anyhow::Result<bool> {
        let start = Instant::now();
        let volume = match self.get_token_market_volume(&token).await? {
            Some(volume) => volume,
            None => return Ok(false),
        };
        if Utc::now() - volume.last_updated > self.available_time {
            vlog::warn!("Token market amount for {} is not relevant", &token.symbol)
        }
        let allowed = ratio_to_big_decimal(&volume.market_volume, 2) >= self.liquidity_volume;
        metrics::histogram!("ticker.validator.check_token", start.elapsed());

        Ok(allowed)
    }

    async fn get_token_market_volume(
        &self,
        token: &Token,
    ) -> anyhow::Result<Option<TokenMarketVolume>> {
        self.tokens_cache.get_token_market_volume(token.id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fee_ticker::validator::cache::TokenInMemoryCache;
    use crate::fee_ticker::validator::watcher::CoinGeckoTokenWatcher;
    use num::BigUint;
    use num::{rational::Ratio, Zero};
    use std::collections::HashMap;
    use std::str::FromStr;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use zksync_types::{TokenId, TokenKind};

    #[derive(Clone)]
    struct InMemoryTokenWatcher {
        amounts: Arc<Mutex<HashMap<Address, BigDecimal>>>,
    }

    #[async_trait::async_trait]
    impl TokenWatcher for InMemoryTokenWatcher {
        async fn get_token_market_volume(&mut self, token: &Token) -> anyhow::Result<BigDecimal> {
            Ok(self
                .amounts
                .lock()
                .await
                .get(&token.address)
                .unwrap()
                .clone())
        }
    }

    #[tokio::test]
    #[ignore]
    // We can use this test only online, run it manually if you need to test connection to coingecko
    async fn get_real_token_amount() {
        let mainnet_rif_contract_addr = "2acc95758f8b5f583470ba265eb685a8f45fc9d5";

        let mut watcher =
            CoinGeckoTokenWatcher::new("https://api.coingecko.com/api/v3".to_string(), 30);
        let rif_token_address: Address = mainnet_rif_contract_addr.parse().unwrap();
        let rif_token = Token::new(TokenId(1), rif_token_address, "RIF", 18, TokenKind::ERC20);
        let amount = watcher.get_token_market_volume(&rif_token).await.unwrap();
        assert!(amount > BigDecimal::zero());
    }

    #[tokio::test]
    async fn check_tokens() {
        // RIF address is from mainnet file in etc>tokens directory
        let rif_token_address =
            Address::from_str("2acc95758f8b5f583470ba265eb685a8f45fc9d5").unwrap();
        let rif_token = Token::new(TokenId(1), rif_token_address, "RIF", 18, TokenKind::ERC20);
        // RDOC address is from mainnet file in etc>tokens directory
        let rdoc_token_address =
            Address::from_str("2d919f19D4892381d58EdEbEcA66D5642ceF1A1F").unwrap();
        let rdoc_token = Token::new(TokenId(2), rdoc_token_address, "RDOC", 18, TokenKind::ERC20);

        let eth_address = Address::from_str("0000000000000000000000000000000000000000").unwrap();
        let eth_token = Token::new(TokenId(2), eth_address, "RBTC", 18, TokenKind::ERC20);
        let all_tokens = vec![rif_token.clone(), rdoc_token.clone()];

        let mut market = HashMap::new();
        market.insert(
            rif_token.id,
            TokenMarketVolume {
                market_volume: Ratio::new(BigUint::from(10u32), BigUint::from(1u32)),
                last_updated: Utc::now(),
            },
        );
        market.insert(
            rdoc_token.id,
            TokenMarketVolume {
                market_volume: Ratio::new(BigUint::from(200u32), BigUint::from(1u32)),
                last_updated: Utc::now(),
            },
        );

        let mut tokens = HashMap::new();
        tokens.insert(TokenLike::Address(rif_token_address), rif_token.clone());
        tokens.insert(TokenLike::Address(rdoc_token_address), rdoc_token.clone());
        tokens.insert(TokenLike::Address(eth_address), eth_token);
        let mut amounts = HashMap::new();
        amounts.insert(rif_token_address, BigDecimal::from(200));
        amounts.insert(rdoc_token_address, BigDecimal::from(10));
        let mut unconditionally_valid = HashSet::new();
        unconditionally_valid.insert(eth_address);

        let cache = TokenInMemoryCache::new()
            .with_tokens(tokens)
            .with_market(market);

        let watcher = InMemoryTokenWatcher {
            amounts: Arc::new(Mutex::new(amounts)),
        };

        let validator = FeeTokenValidator::new(
            cache.clone(),
            chrono::Duration::seconds(100),
            BigDecimal::from(100),
            unconditionally_valid,
        );

        let mut updater = MarketUpdater::new(cache, watcher);
        updater.update_all_tokens(all_tokens).await.unwrap();

        let new_rif_token_market = validator
            .tokens_cache
            .get_token_market_volume(rif_token.id)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(
            new_rif_token_market.market_volume,
            big_decimal_to_ratio(&BigDecimal::from(200)).unwrap()
        );

        let new_rdoc_token_market = validator
            .tokens_cache
            .get_token_market_volume(rdoc_token.id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            new_rdoc_token_market.market_volume,
            big_decimal_to_ratio(&BigDecimal::from(10)).unwrap()
        );

        let rif_allowed = validator
            .token_allowed(TokenLike::Address(rif_token_address))
            .await
            .unwrap();
        let rdoc_allowed = validator
            .token_allowed(TokenLike::Address(rdoc_token_address))
            .await
            .unwrap();
        let eth_allowed = validator
            .token_allowed(TokenLike::Address(eth_address))
            .await
            .unwrap();
        assert!(rif_allowed);
        assert!(!rdoc_allowed);
        assert!(eth_allowed);
    }
}
