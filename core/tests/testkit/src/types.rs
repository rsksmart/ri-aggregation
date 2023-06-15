//! Common primitives used within testkit.
use num::BigUint;
use std::collections::HashMap;
use web3::types::TransactionReceipt;
use zksync_config::ZkSyncConfig;
use zksync_types::block::Block;
use zksync_types::TokenId;

#[derive(Debug, Clone)]
pub struct TestkitConfig {
    pub chain_id: u64,
    pub gas_price_factor: f64,
    pub web3_url: String,
    pub contract_upgrade_eth_blocks: Vec<u64>,
    pub init_contract_version: u32,
}

impl TestkitConfig {
    pub fn from_env() -> Self {
        let config = ZkSyncConfig::from_env();
        TestkitConfig {
            chain_id: config.rsk_client.chain_id,
            gas_price_factor: config.rsk_client.gas_price_factor,
            web3_url: config.rsk_client.web3_url(),
            contract_upgrade_eth_blocks: config.contracts.upgrade_eth_blocks,
            init_contract_version: config.contracts.init_contract_version,
        }
    }
}

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct RSKAccountId(pub usize);

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct ZKSyncAccountId(pub usize);

#[derive(Copy, Clone, PartialEq, Eq, Hash)]
pub struct Token(pub TokenId);

#[derive(Debug, Clone)]
pub struct BlockExecutionResult {
    pub block: Block,
    pub commit_result: TransactionReceipt,
    pub verify_result: TransactionReceipt,
    pub withdrawals_result: TransactionReceipt,
    pub pending_withdrawals_result: Option<TransactionReceipt>,
    pub block_size_chunks: usize,
}

impl BlockExecutionResult {
    pub fn new(
        block: Block,
        commit_result: TransactionReceipt,
        verify_result: TransactionReceipt,
        withdrawals_result: TransactionReceipt,
        pending_withdrawals_result: Option<TransactionReceipt>,
        block_size_chunks: usize,
    ) -> Self {
        Self {
            block,
            commit_result,
            verify_result,
            withdrawals_result,
            pending_withdrawals_result,
            block_size_chunks,
        }
    }
}

// Struct used to keep expected balance changes after transactions execution.
#[derive(Default, Debug)]
pub struct ExpectedAccountState {
    pub eth_accounts_state: HashMap<(RSKAccountId, TokenId), BigUint>,
    pub sync_accounts_state: HashMap<(ZKSyncAccountId, TokenId), BigUint>,

    // Amount of withdraw operations performed in block.
    pub withdraw_ops: usize,
}
