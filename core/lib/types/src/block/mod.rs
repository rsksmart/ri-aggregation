//! zkSync network block definition.

use super::{AccountId, BlockNumber, Fr, PriorityOp, ZkSyncOp};
use crate::{tx::error::CloseOperationsDisabled, SignedZkSyncTx, TokenId};
use chrono::Utc;
use chrono::{DateTime, TimeZone};
use parity_crypto::digest::sha256;
use parity_crypto::Keccak256;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use zksync_basic_types::{H256, U256};
use zksync_crypto::franklin_crypto::bellman::pairing::ff::{PrimeField, PrimeFieldRepr};
use zksync_crypto::params::{CHUNK_BIT_WIDTH, CHUNK_BYTES};
use zksync_crypto::serialization::FrSerde;

mod incomplete_block;

pub use incomplete_block::IncompleteBlock;

/// An intermediate state of the block in the Rollup network.
/// Contains the information about (so far) executed transactions and
/// meta-information related to the block creating process.
#[derive(Clone, Debug)]
pub struct PendingBlock {
    /// Block ID.
    pub number: BlockNumber,
    /// Amount of chunks left in the block.
    pub chunks_left: usize,
    /// ID of the first unprocessed priority operation at the moment
    /// of the block initialization.
    pub unprocessed_priority_op_before: u64,
    /// Amount of processing iterations applied to the pending block.
    /// If this amount exceeds the limit configured in the server, block will be
    /// sealed even if it's not full.
    pub pending_block_iteration: usize,
    /// List of successfully executed operations.
    pub success_operations: Vec<ExecutedOperations>,
    /// List of failed operations.
    pub failed_txs: Vec<ExecutedTx>,
    /// Timestamp
    pub timestamp: u64,
}

/// Executed L2 transaction.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutedTx {
    pub signed_tx: SignedZkSyncTx,
    pub success: bool,
    pub op: Option<ZkSyncOp>,
    pub fail_reason: Option<String>,
    pub block_index: Option<u32>,
    pub created_at: DateTime<Utc>,
    pub batch_id: Option<i64>,
}

/// Executed L1 priority operation.
/// Unlike L2 transactions, L1 priority operations cannot fail in L2.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutedPriorityOp {
    pub priority_op: PriorityOp,
    pub op: ZkSyncOp,
    pub block_index: u32,
    pub created_at: DateTime<Utc>,
}

impl ExecutedPriorityOp {
    /// Returns Id of the account affected by the priority operation.
    pub fn account_id(&self) -> AccountId {
        match &self.priority_op.data {
            crate::ZkSyncPriorityOp::Deposit(_) => {
                if let ZkSyncOp::Deposit(ref deposit) = self.op {
                    deposit.account_id
                } else {
                    panic!("Invalid type of Rollup operation, expected deposit")
                }
            }
            crate::ZkSyncPriorityOp::FullExit(full_exit) => full_exit.account_id,
        }
    }
}

/// Representation of executed operation, which can be either L1 or L2.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ExecutedOperations {
    Tx(Box<ExecutedTx>),
    PriorityOp(Box<ExecutedPriorityOp>),
}

impl ExecutedOperations {
    /// Returns Id of the account affected by the operation.

    pub fn token_id(&self) -> TokenId {
        match self {
            ExecutedOperations::Tx(tx) => tx.signed_tx.tx.token_id(),
            ExecutedOperations::PriorityOp(op) => op.priority_op.data.token_id(),
        }
    }

    pub fn variance_name(&self) -> String {
        match self {
            ExecutedOperations::Tx(tx) => tx.signed_tx.tx.variance_name(),
            ExecutedOperations::PriorityOp(op) => op.priority_op.data.variance_name(),
        }
    }

    pub fn account_id(&self) -> Result<AccountId, CloseOperationsDisabled> {
        match self {
            ExecutedOperations::Tx(tx) => tx.signed_tx.account_id(),
            ExecutedOperations::PriorityOp(priority_op) => Ok(priority_op.account_id()),
        }
    }

    /// Returns the `ZkSyncOp` object associated with the operation, if any.
    pub fn get_executed_op(&self) -> Option<&ZkSyncOp> {
        match self {
            ExecutedOperations::Tx(exec_tx) => exec_tx.op.as_ref(),
            ExecutedOperations::PriorityOp(exec_op) => Some(&exec_op.op),
        }
    }

    /// Attempts to get the executed L1 transaction.
    pub fn get_executed_tx(&self) -> Option<&ExecutedTx> {
        match self {
            ExecutedOperations::Tx(exec_tx) => Some(exec_tx),
            ExecutedOperations::PriorityOp(_) => None,
        }
    }

    /// Returns the public data required for the Rootstock smart contract to commit the operation.
    pub fn get_eth_public_data(&self) -> Vec<u8> {
        self.get_executed_op()
            .map(ZkSyncOp::public_data)
            .unwrap_or_default()
    }

    /// Gets the witness required for the Rootstock smart contract.
    /// Unlike public data, some operations may not have a witness.
    pub fn get_eth_witness_bytes(&self) -> Option<Vec<u8>> {
        self.get_executed_op()
            .map(|op| op.eth_witness().unwrap_or_default())
    }

    /// Returns the list of accounts affected by the operation.
    pub fn get_updated_account_ids(&self) -> Vec<AccountId> {
        self.get_executed_op()
            .map(|op| op.get_updated_account_ids())
            .unwrap_or_default()
    }

    /// Returns `true` if the operation was successful.
    pub fn is_successful(&self) -> bool {
        // L1 priority operations cannot fail in L2.
        match self {
            ExecutedOperations::Tx(exec_tx) => exec_tx.success,
            ExecutedOperations::PriorityOp(_) => true,
        }
    }

    pub fn elapsed(&self) -> Duration {
        let created_at = match self {
            ExecutedOperations::Tx(tx) => tx.created_at,
            ExecutedOperations::PriorityOp(op) => op.created_at,
        };
        (Utc::now() - created_at).to_std().unwrap_or_default()
    }

    pub fn is_priority(&self) -> bool {
        matches!(self, Self::PriorityOp(_))
    }
}

/// zkSync network block.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    /// Block ID.
    pub block_number: BlockNumber,
    /// Chain root hash obtained after executing this block.
    #[serde(with = "FrSerde")]
    pub new_root_hash: Fr,
    /// ID of the zkSync account to which fees are collected.
    pub fee_account: AccountId,
    /// List of operations executed in the block. Includes both L1 and L2 operations.
    pub block_transactions: Vec<ExecutedOperations>,
    /// A tuple of ID of the first unprocessed priority operation before and after this block.
    pub processed_priority_ops: (u64, u64),
    /// Actual block chunks amount that will be used on contract, such that `block_chunks_sizes >= block.chunks_used()`.
    /// Server and provers may support blocks of several different sizes, and this value must be equal to one of the
    /// supported size values.
    pub block_chunks_size: usize,

    /// Gas limit to be set for the Commit Rootstock transaction.
    pub commit_gas_limit: U256,
    /// Gas limit to be set for the Verify Rootstock transaction.
    pub verify_gas_limit: U256,
    /// Commitment
    pub block_commitment: H256,
    /// Timestamp
    pub timestamp: u64,
}

impl Block {
    /// Creates a new `Block` object.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        block_number: BlockNumber,
        new_root_hash: Fr,
        fee_account: AccountId,
        block_transactions: Vec<ExecutedOperations>,
        processed_priority_ops: (u64, u64),
        block_chunks_size: usize,
        commit_gas_limit: U256,
        verify_gas_limit: U256,
        block_commitment: H256,
        timestamp: u64,
    ) -> Self {
        Self {
            block_number,
            new_root_hash,
            fee_account,
            block_transactions,
            processed_priority_ops,
            block_chunks_size,
            commit_gas_limit,
            verify_gas_limit,
            block_commitment,
            timestamp,
        }
    }

    /// Creates a new block from an incomplete one.
    pub fn from_incomplete(
        incomplete: IncompleteBlock,
        previous_block_root_hash: Fr,
        new_root_hash: Fr,
    ) -> Self {
        // Encode previous block root to the Rootstock format.
        let previous_block_root_hash = Self::encode_fr_for_eth(previous_block_root_hash);

        let mut block = Self {
            // Copied fields.
            block_number: incomplete.block_number,
            fee_account: incomplete.fee_account,
            block_transactions: incomplete.block_transactions,
            processed_priority_ops: incomplete.processed_priority_ops,
            block_chunks_size: incomplete.block_chunks_size,
            commit_gas_limit: incomplete.commit_gas_limit,
            verify_gas_limit: incomplete.verify_gas_limit,
            timestamp: incomplete.timestamp,

            // Fields *not* from the incomplete block.
            new_root_hash,
            block_commitment: H256::default(),
        };
        block.block_commitment = Block::get_commitment(
            block.block_number,
            block.fee_account,
            previous_block_root_hash,
            block.get_eth_encoded_root(),
            block.timestamp,
            &block.get_onchain_op_commitment(),
            &block.get_eth_public_data(),
        );
        block
    }

    /// Creates a new block, choosing the smallest supported block size which will fit
    /// all the executed transactions.
    ///
    /// # Panics
    ///
    /// Panics if there is no supported block size to fit all the transactions.
    #[allow(clippy::too_many_arguments)]
    pub fn new_from_available_block_sizes(
        block_number: BlockNumber,
        new_root_hash: Fr,
        fee_account: AccountId,
        block_transactions: Vec<ExecutedOperations>,
        processed_priority_ops: (u64, u64),
        available_block_chunks_sizes: &[usize],
        commit_gas_limit: U256,
        verify_gas_limit: U256,
        previous_block_root_hash: H256,
        timestamp: u64,
    ) -> Self {
        let mut block = Self {
            block_number,
            new_root_hash,
            fee_account,
            block_transactions,
            processed_priority_ops,
            block_chunks_size: 0,
            commit_gas_limit,
            verify_gas_limit,
            block_commitment: H256::default(),
            timestamp,
        };
        block.block_chunks_size = block.smallest_block_size(available_block_chunks_sizes);
        block.block_commitment = Block::get_commitment(
            block_number,
            fee_account,
            previous_block_root_hash,
            block.get_eth_encoded_root(),
            block.timestamp,
            &block.get_onchain_op_commitment(),
            &block.get_eth_public_data(),
        );
        block
    }

    /// Encodes any `Fr` hash to `H256`.
    pub fn encode_fr_for_eth(fr: Fr) -> H256 {
        let mut be_bytes = [0u8; 32];
        fr.into_repr()
            .write_be(be_bytes.as_mut())
            .expect("Write commit bytes");
        H256::from(be_bytes)
    }

    /// Returns the new state root hash encoded for the Rootstock smart contract.
    pub fn get_eth_encoded_root(&self) -> H256 {
        Self::encode_fr_for_eth(self.new_root_hash)
    }

    /// Returns the public data for the Rootstock Commit operation.
    pub fn get_eth_public_data(&self) -> Vec<u8> {
        let mut executed_tx_pub_data = self
            .block_transactions
            .iter()
            .filter_map(ExecutedOperations::get_executed_op)
            .flat_map(ZkSyncOp::public_data)
            .collect::<Vec<_>>();

        // Pad block with noops.
        executed_tx_pub_data.resize(self.block_chunks_size * CHUNK_BIT_WIDTH / 8, 0x00);

        executed_tx_pub_data
    }

    /// Returns eth_witness data and data_size for each operation that has it.
    pub fn get_eth_witness_data(&self) -> (Vec<u8>, Vec<u64>) {
        let mut eth_witness = Vec::new();
        let mut used_bytes = Vec::new();

        for block_tx in &self.block_transactions {
            if let Some(franklin_op) = block_tx.get_executed_op() {
                if let Some(witness_bytes) = franklin_op.eth_witness() {
                    used_bytes.push(witness_bytes.len() as u64);
                    eth_witness.extend(witness_bytes.into_iter());
                }
            }
        }

        (eth_witness, used_bytes)
    }

    /// Returns the number of priority operations processed in this block.
    pub fn number_of_processed_prior_ops(&self) -> u64 {
        self.processed_priority_ops.1 - self.processed_priority_ops.0
    }

    fn chunks_used(&self) -> usize {
        self.block_transactions
            .iter()
            .filter_map(ExecutedOperations::get_executed_op)
            .map(ZkSyncOp::chunks)
            .sum()
    }

    fn smallest_block_size(&self, available_block_sizes: &[usize]) -> usize {
        let chunks_used = self.chunks_used();
        smallest_block_size_for_chunks(chunks_used, available_block_sizes)
    }

    /// Returns the number of Withdrawal and ForcedExit in a block.
    pub fn get_withdrawals_count(&self) -> usize {
        let mut withdrawals_count = 0;

        for block_tx in &self.block_transactions {
            if let Some(sync_op) = block_tx.get_executed_op() {
                if sync_op.withdrawal_data().is_some() {
                    withdrawals_count += 1;
                }
            }
        }

        withdrawals_count
    }

    /// Returns the data about withdrawals required for the Rootstock smart contract.
    pub fn get_withdrawals_data(&self) -> Vec<u8> {
        let mut withdrawals_data = Vec::new();

        for block_tx in &self.block_transactions {
            if let Some(franklin_op) = block_tx.get_executed_op() {
                if let Some(withdrawal_data) = franklin_op.withdrawal_data() {
                    withdrawals_data.extend(&withdrawal_data);
                }
            }
        }

        withdrawals_data
    }

    pub fn get_onchain_operations_block_info(
        &self,
    ) -> (Vec<OnchainOperationsBlockInfo>, H256, u64) {
        let mut onchain_ops = Vec::new();
        let mut processable_ops_hash = Vec::new().keccak256();
        let mut public_data_offset = 0;
        let mut priority_ops = 0;

        for op in &self.block_transactions {
            if let Some(executed_op) = op.get_executed_op() {
                if executed_op.is_onchain_operation() {
                    onchain_ops.push(OnchainOperationsBlockInfo {
                        public_data_offset,
                        eth_witness: executed_op.eth_witness().unwrap_or_default(),
                    })
                }

                if executed_op.is_processable_onchain_operation() {
                    processable_ops_hash =
                        [&processable_ops_hash, executed_op.public_data().as_slice()]
                            .concat()
                            .keccak256();
                }

                if executed_op.is_priority_op() {
                    priority_ops += 1;
                }

                public_data_offset += (CHUNK_BIT_WIDTH / 8 * executed_op.chunks()) as u32;
            }
        }

        (onchain_ops, H256::from(processable_ops_hash), priority_ops)
    }

    /// Returns the public data for the Rootstock Commit operation.
    pub fn get_onchain_op_commitment(&self) -> Vec<u8> {
        let mut res = vec![0u8; self.block_chunks_size];
        for op in self.get_onchain_operations_block_info().0 {
            res[op.public_data_offset as usize / CHUNK_BYTES] = 0x01;
        }
        res
    }

    fn get_commitment(
        block_number: BlockNumber,
        fee_account: AccountId,
        old_state_hash: H256,
        new_state_hash: H256,
        timestamp: u64,
        onchain_op_commitment: &[u8],
        public_data: &[u8],
    ) -> H256 {
        let mut hash_arg = vec![0u8; 64];
        U256::from(*block_number).to_big_endian(&mut hash_arg[0..32]);
        U256::from(*fee_account).to_big_endian(&mut hash_arg[32..]);
        hash_arg = sha256(&hash_arg).to_vec();

        hash_arg.extend_from_slice(old_state_hash.as_bytes());
        hash_arg = sha256(&hash_arg).to_vec();

        hash_arg.extend_from_slice(new_state_hash.as_bytes());
        hash_arg = sha256(&hash_arg).to_vec();

        hash_arg.resize(64, 0u8);
        U256::from(timestamp).to_big_endian(&mut hash_arg[32..]);
        hash_arg = sha256(&hash_arg).to_vec();

        hash_arg.extend_from_slice(public_data);
        hash_arg.extend_from_slice(onchain_op_commitment);
        H256::from_slice(&sha256(&hash_arg))
    }

    pub fn processable_ops_pubdata(&self) -> Vec<Vec<u8>> {
        self.block_transactions
            .iter()
            .filter_map(|tx| tx.get_executed_op())
            .filter_map(|op| {
                if op.is_processable_onchain_operation() {
                    Some(op.public_data())
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn timestamp_utc(&self) -> DateTime<Utc> {
        Utc.timestamp(self.timestamp as i64, 0)
    }

    pub fn elapsed(&self) -> Duration {
        (Utc::now() - self.timestamp_utc())
            .to_std()
            .unwrap_or_default()
    }
}

/// Gets smallest block size given the list of supported chunk sizes.
pub fn smallest_block_size_for_chunks(
    chunks_used: usize,
    available_block_sizes: &[usize],
) -> usize {
    for &block_size in available_block_sizes {
        if block_size >= chunks_used {
            return block_size;
        }
    }
    panic!(
        "Provided chunks amount ({}) cannot fit in one block, maximum available size is {}",
        chunks_used,
        available_block_sizes.last().unwrap()
    );
}

#[derive(Debug, Clone)]
pub struct OnchainOperationsBlockInfo {
    pub public_data_offset: u32,
    pub eth_witness: Vec<u8>,
}

/// Additional data attached to block that is not related to the core protocol
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockMetadata {
    pub fast_processing: bool,
}
