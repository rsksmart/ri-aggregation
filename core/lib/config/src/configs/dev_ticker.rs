use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::envy_load;

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DevTickerConfig {
    pub blacklisted_tokens: HashSet<String>,
    pub default_volume: u32,
    pub regime: Regime,
    pub proxy_cache_timout: u16,
}

impl DevTickerConfig {
    pub fn from_env() -> Self {
        envy_load!("dev-ticker", "DEV_TICKER_")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Regime {
    Blacklist,
    Whitelist,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configs::test_utils::set_env;

    fn expected_config() -> DevTickerConfig {
        let mut blacklisted_tokens = HashSet::new();
        blacklisted_tokens.insert("0x0000000000000000000000000000000000000001".to_string());
        DevTickerConfig {
            blacklisted_tokens,
            default_volume: 500,
            regime: Regime::Whitelist,
            proxy_cache_timout: 5,
        }
    }

    #[test]
    fn from_env() {
        let config = r#"
DEV_TICKER_BLACKLISTED_TOKENS="0x6b175474e89094c44da98b954eedeac495271d0f"
DEV_TICKER_BLACKLISTED_TOKENS="0x0000000000000000000000000000000000000001"
DEV_TICKER_DEFAULT_VOLUME="500"
DEV_TICKER_REGIME="whitelist"
DEV_TICKER_PROXY_CACHE_TIMEOUT="5"
        "#;
        set_env(config);

        let actual = DevTickerConfig::from_env();
        assert_eq!(actual, expected_config());
    }
}
