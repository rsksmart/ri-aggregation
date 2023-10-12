use std::collections::HashMap;

use num::{rational::Ratio, BigUint};
use serde::{Deserialize, Serialize};
use zksync_utils::UnsignedRatioSerializeAsDecimal;

// --------- locally simplified Contract struct for retreiving market data only
#[derive(Serialize, Deserialize, Debug, Default, PartialEq)]
pub struct TotalVolumeSimplified {
    pub usd: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq)]
pub struct MarketDataSimplified {
    pub total_volume: TotalVolumeSimplified,
}

#[derive(Serialize, Deserialize, Debug, Default, PartialEq)]
pub struct ContractSimplified {
    pub liquidity_score: f64,
    pub market_data: MarketDataSimplified,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AssetPlatform {
    pub id: String,
    pub chain_identifier: Option<i64>,
    pub name: String,
    pub shortname: String,
}

// ---------------------------------------------
//  /coins/list
// ---------------------------------------------
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CoinsListItem {
    pub id: String,
    pub symbol: String,
    pub name: String,
    pub platforms: Option<HashMap<String, Option<String>>>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinGeckoTokenPrice(
    pub i64, // timestamp (milliseconds)
    #[serde(with = "UnsignedRatioSerializeAsDecimal")] pub Ratio<BigUint>, // price
);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinGeckoMarketChart {
    pub prices: Vec<CoinGeckoTokenPrice>,
}