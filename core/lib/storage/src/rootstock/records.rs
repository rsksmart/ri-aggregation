// External imports
use chrono::{DateTime, Utc};
use sqlx::{types::BigDecimal, FromRow};
// Workspace imports
// Local imports

#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct StorageRSKOperation {
    pub id: i64,
    pub nonce: i64,
    pub confirmed: bool,
    pub raw_tx: Vec<u8>,
    pub op_type: String,
    pub final_hash: Option<Vec<u8>>,
    pub last_deadline_block: i64,
    pub last_used_gas_price: BigDecimal,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct RSKOperationData {
    pub id: i64,
    pub nonce: i64,
    pub confirmed: bool,
    pub raw_tx: Vec<u8>,
    pub op_type: String,
    pub final_hash: Option<Vec<u8>>,
    pub last_deadline_block: i64,
    pub last_used_gas_price: BigDecimal,
    pub agg_op_id: Option<i64>,
    pub arguments: Option<serde_json::Value>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct RSKTxHash {
    pub id: i64,
    pub rsk_op_id: i64,
    pub tx_hash: Vec<u8>,
}

#[derive(Debug, FromRow, PartialEq)]
pub struct RSKParams {
    pub id: bool,
    pub nonce: i64,
    pub gas_price_limit: i64,
    pub average_gas_price: Option<i64>,
    pub last_committed_block: i64,
    pub last_verified_block: i64,
    pub last_executed_block: i64,
}

/// A slice of `RSKParams` structure with only stats part in it.
#[derive(Debug)]
pub struct RSKStats {
    pub last_committed_block: i64,
    pub last_verified_block: i64,
    pub last_executed_block: i64,
}

impl From<RSKParams> for RSKStats {
    fn from(params: RSKParams) -> Self {
        Self {
            last_committed_block: params.last_committed_block,
            last_verified_block: params.last_verified_block,
            last_executed_block: params.last_executed_block,
        }
    }
}
