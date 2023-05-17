use serde::{Deserialize, Serialize};

// --------- locally simplified Contract struct for retreiving market data only
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct TotalVolumeSimplified {
    pub usd: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct MarketDataSimplified {
    pub total_volume: TotalVolumeSimplified,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ContractSimplified {
    pub liquidity_score: f64,
    pub market_data: MarketDataSimplified,
}

// --------- from coingecko sdk

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AssetPlatform {
    pub id: String,
    pub chain_identifier: Option<i64>,
    pub name: String,
    pub shortname: String,
}
