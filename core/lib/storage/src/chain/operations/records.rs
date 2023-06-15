// External imports
use chrono::prelude::*;
use serde_json::value::Value;
use sqlx::FromRow;
use zksync_types::{PriorityOp, H256};
// Workspace imports
// Local imports

#[derive(Debug, Clone, FromRow, PartialEq)]
pub struct StoredExecutedPriorityOperation {
    // Number from a sequence consisting of priority operations and transactions
    pub sequence_number: Option<i64>,
    pub block_number: i64,
    pub block_index: i32,
    pub operation: Value,
    pub from_account: Vec<u8>,
    pub to_account: Vec<u8>,
    pub priority_op_serialid: i64,
    pub deadline_block: i64,
    pub eth_hash: Vec<u8>,
    pub rsk_block: i64,
    pub created_at: DateTime<Utc>,
    /// This field must be optional because of backward compatibility.
    pub eth_block_index: Option<i64>,
    pub tx_hash: Vec<u8>,
}

impl From<StoredExecutedPriorityOperation> for PriorityOp {
    fn from(value: StoredExecutedPriorityOperation) -> Self {
        Self {
            serial_id: value.priority_op_serialid as u64,
            data: serde_json::from_value(value.operation).expect("Should be correctly stored"),
            deadline_block: value.deadline_block as u64,
            eth_hash: H256::from_slice(&value.eth_hash),
            rsk_block: value.rsk_block as u64,
            eth_block_index: Some(value.block_index as u64),
        }
    }
}

#[derive(Debug, Clone, FromRow)]
pub(crate) struct StoredExecutedTransaction {
    // Number from a sequence consisting of priority operations and transactions
    #[allow(dead_code)]
    pub sequence_number: Option<i64>,
    pub block_number: i64,
    pub block_index: Option<i32>,
    pub tx: Value,
    pub operation: Value,
    #[allow(dead_code)]
    pub tx_hash: Vec<u8>,
    #[allow(dead_code)]
    pub from_account: Vec<u8>,
    #[allow(dead_code)]
    pub to_account: Option<Vec<u8>>,
    pub success: bool,
    pub fail_reason: Option<String>,
    #[allow(dead_code)]
    pub primary_account_address: Vec<u8>,
    #[allow(dead_code)]
    pub nonce: i64,
    pub created_at: DateTime<Utc>,
    pub eth_sign_data: Option<serde_json::Value>,
    pub batch_id: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct NewExecutedPriorityOperation {
    pub block_number: i64,
    pub block_index: i32,
    pub operation: Value,
    pub from_account: Vec<u8>,
    pub to_account: Vec<u8>,
    pub priority_op_serialid: i64,
    pub deadline_block: i64,
    pub eth_hash: Vec<u8>,
    pub rsk_block: i64,
    pub created_at: DateTime<Utc>,
    /// This field must be optional because of backward compatibility.
    pub eth_block_index: Option<i64>,
    pub tx_hash: Vec<u8>,
    pub affected_accounts: Vec<Vec<u8>>,
    pub token: i32,
}

#[derive(Debug, Clone)]
pub(crate) struct NewExecutedTransaction {
    pub block_number: i64,
    pub block_index: Option<i32>,
    pub tx: Value,
    pub operation: Value,
    pub tx_hash: Vec<u8>,
    pub from_account: Vec<u8>,
    pub to_account: Option<Vec<u8>>,
    pub success: bool,
    pub fail_reason: Option<String>,
    pub primary_account_address: Vec<u8>,
    pub nonce: i64,
    pub created_at: DateTime<Utc>,
    pub eth_sign_data: Option<serde_json::Value>,
    pub batch_id: Option<i64>,
    pub affected_accounts: Vec<Vec<u8>>,
    pub used_tokens: Vec<i32>,
}

#[derive(Debug, Clone)]
pub(crate) struct StoredPendingWithdrawal {
    pub id: i64,
    #[allow(dead_code)]
    pub withdrawal_hash: Vec<u8>,
}

#[derive(Debug, Clone)]
pub(crate) struct StoredCompleteWithdrawalsTransaction {
    pub tx_hash: Vec<u8>,
    #[allow(dead_code)]
    pub pending_withdrawals_queue_start_index: i64,
    #[allow(dead_code)]
    pub pending_withdrawals_queue_end_index: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct StoredAggregatedOperation {
    pub id: i64,
    pub action_type: String,
    pub arguments: serde_json::Value,
    pub from_block: i64,
    pub to_block: i64,
    pub created_at: DateTime<Utc>,
    pub confirmed: bool,
}
