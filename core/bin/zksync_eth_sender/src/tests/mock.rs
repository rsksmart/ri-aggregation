//! Mocking utilities for tests.

// Built-in deps
use std::collections::VecDeque;
use std::convert::TryFrom;
// External uses
use tokio::sync::RwLock;
use web3::contract::Options;
use zksync_basic_types::{BlockNumber, H256, U256};
// Workspace uses
use zksync_config::configs::eth_sender::{GasLimit, RSKSenderConfig, Sender};
use zksync_rsk_client::RootstockGateway;
use zksync_storage::{rootstock::records::RSKParams, StorageProcessor};
use zksync_types::aggregated_operations::{AggregatedActionType, AggregatedOperation};
use zksync_types::rootstock::{InsertedOperationResponse, RSKOpId, RSKOperation};
// Local uses
use super::RSKSender;
use crate::database::DatabaseInterface;
use crate::transactions::RSKStats;
use zksync_rsk_client::clients::mock::MockRootstock;

/// Mock database is capable of recording all the incoming requests for the further analysis.
#[derive(Debug)]
pub(crate) struct MockDatabase {
    rsk_operations: RwLock<Vec<RSKOperation>>,
    aggregated_operations: RwLock<Vec<(i64, AggregatedOperation)>>,
    unprocessed_operations: RwLock<Vec<(i64, AggregatedOperation)>>,
    rsk_parameters: RwLock<RSKParams>,
}

impl MockDatabase {
    /// Creates a database with emulation of previously stored uncommitted requests.
    pub fn with_restorable_state(
        rsk_operations: Vec<RSKOperation>,
        aggregated_operations: Vec<(i64, AggregatedOperation)>,
        unprocessed_operations: Vec<(i64, AggregatedOperation)>,
        rsk_parameters: RSKParams,
    ) -> Self {
        Self {
            rsk_operations: RwLock::new(rsk_operations),
            aggregated_operations: RwLock::new(aggregated_operations),
            unprocessed_operations: RwLock::new(unprocessed_operations),
            rsk_parameters: RwLock::new(rsk_parameters),
        }
    }

    pub async fn update_gas_price_limit(&self, value: i64) -> anyhow::Result<()> {
        let mut rsk_parameters = self.rsk_parameters.write().await;
        rsk_parameters.gas_price_limit = value;

        Ok(())
    }

    /// Simulates the operation of OperationsSchema, creates a new operation in the database.
    pub async fn send_aggregated_operation(
        &mut self,
        aggregated_operation: (i64, AggregatedOperation),
    ) -> anyhow::Result<()> {
        self.unprocessed_operations
            .write()
            .await
            .push(aggregated_operation.clone());
        self.aggregated_operations
            .write()
            .await
            .push(aggregated_operation);

        Ok(())
    }

    /// Ensures that the provided transaction is stored in the database and not confirmed yet.
    pub async fn assert_stored(&self, tx: &RSKOperation) {
        let rsk_operations = self.rsk_operations.read().await;
        let is_stored = rsk_operations
            .iter()
            .any(|rsk_op| rsk_op.id == tx.id && !rsk_op.confirmed);

        assert!(is_stored);
    }

    /// Ensures that the provided transaction is stored as confirmed.
    pub async fn assert_confirmed(&self, tx: &RSKOperation) {
        let rsk_operations = self.rsk_operations.read().await;
        let is_confirmed = rsk_operations
            .iter()
            .any(|rsk_op| rsk_op.id == tx.id && rsk_op.confirmed);

        assert!(is_confirmed);
    }

    /// Returns the stored average gas price.
    pub async fn average_gas_price(&self) -> U256 {
        let rsk_parameters = self.rsk_parameters.read().await;

        U256::from(rsk_parameters.average_gas_price.unwrap_or_default() as u64)
    }
}

#[async_trait::async_trait]
impl DatabaseInterface for MockDatabase {
    /// Creates a new database connection, used as a stub
    /// and nothing will be sent through this connection.
    async fn acquire_connection(&self) -> anyhow::Result<StorageProcessor<'_>> {
        StorageProcessor::establish_connection().await
    }

    /// Returns all unprocessed operations.
    async fn load_new_operations(
        &self,
        _connection: &mut StorageProcessor<'_>,
    ) -> anyhow::Result<Vec<(i64, AggregatedOperation)>> {
        let unprocessed_operations = self
            .unprocessed_operations
            .read()
            .await
            .iter()
            .cloned()
            .collect::<Vec<_>>();

        Ok(unprocessed_operations)
    }

    /// Remove the unprocessed operations from the database.
    async fn remove_unprocessed_operations(
        &self,
        _connection: &mut StorageProcessor<'_>,
        operations_id: Vec<i64>,
    ) -> anyhow::Result<()> {
        let mut old_unprocessed_operations = self.unprocessed_operations.write().await;

        let mut new_unprocessed_operations = Vec::new();
        for operation in old_unprocessed_operations.iter() {
            if !operations_id.iter().any(|id| &operation.0 == id) {
                new_unprocessed_operations.push(operation.clone());
            }
        }
        *old_unprocessed_operations = new_unprocessed_operations;

        Ok(())
    }

    async fn update_gas_price_params(
        &self,
        _connection: &mut StorageProcessor<'_>,
        gas_price_limit: U256,
        average_gas_price: U256,
    ) -> anyhow::Result<()> {
        let mut rsk_parameters = self.rsk_parameters.write().await;
        rsk_parameters.gas_price_limit =
            i64::try_from(gas_price_limit).expect("Can't convert U256 to i64");
        rsk_parameters.average_gas_price =
            Some(i64::try_from(average_gas_price).expect("Can't convert U256 to i64"));

        Ok(())
    }

    async fn restore_unprocessed_operations(
        &self,
        _connection: &mut StorageProcessor<'_>,
    ) -> anyhow::Result<()> {
        let aggregated_operations = self.aggregated_operations.read().await;
        let rsk_operations = self.rsk_operations.read().await;
        let mut unprocessed_operations = self.unprocessed_operations.write().await;

        let mut new_unprocessed_operations = Vec::new();

        for operation in aggregated_operations.iter() {
            let is_operation_in_queue = unprocessed_operations
                .iter()
                .any(|unprocessed_operation| unprocessed_operation.0 == operation.0);
            let is_operation_send_to_rootstock = rsk_operations.iter().any(|rootstock_operation| {
                rootstock_operation.op.as_ref().unwrap().0 == operation.0
            });
            if !is_operation_in_queue && !is_operation_send_to_rootstock {
                new_unprocessed_operations.push(operation.clone());
            }
        }

        unprocessed_operations.extend(new_unprocessed_operations);

        Ok(())
    }

    async fn load_unconfirmed_operations(
        &self,
        _connection: &mut StorageProcessor<'_>,
    ) -> anyhow::Result<VecDeque<RSKOperation>> {
        let unconfirmed_operations = self
            .rsk_operations
            .read()
            .await
            .iter()
            .cloned()
            .filter(|rsk_op| !rsk_op.confirmed)
            .collect();

        Ok(unconfirmed_operations)
    }

    async fn save_new_rsk_tx(
        &self,
        _connection: &mut StorageProcessor<'_>,
        op_type: AggregatedActionType,
        op: Option<(i64, AggregatedOperation)>,
        deadline_block: i64,
        used_gas_price: U256,
        encoded_tx_data: Vec<u8>,
    ) -> anyhow::Result<InsertedOperationResponse> {
        let mut rsk_operations = self.rsk_operations.write().await;
        let id = rsk_operations.len() as i64;
        let nonce = rsk_operations.len();

        // Store with the assigned ID.
        let rsk_operation = RSKOperation {
            id,
            op_type,
            op,
            nonce: nonce.into(),
            last_deadline_block: deadline_block as u64,
            last_used_gas_price: used_gas_price,
            used_tx_hashes: vec![],
            encoded_tx_data,
            confirmed: false,
            final_hash: None,
        };

        rsk_operations.push(rsk_operation);

        let response = InsertedOperationResponse {
            id,
            nonce: nonce.into(),
        };

        Ok(response)
    }

    /// Adds a tx hash entry associated with some Rootstock operation to the database.
    async fn add_hash_entry(
        &self,
        _connection: &mut StorageProcessor<'_>,
        rsk_op_id: i64,
        hash: &H256,
    ) -> anyhow::Result<()> {
        let mut rsk_operations = self.rsk_operations.write().await;
        let rsk_op = rsk_operations
            .iter_mut()
            .find(|rsk_op| rsk_op.id == rsk_op_id && !rsk_op.confirmed);

        if let Some(rsk_op) = rsk_op {
            rsk_op.used_tx_hashes.push(*hash);
        } else {
            panic!("Attempt to update tx that is not unconfirmed");
        }

        Ok(())
    }

    async fn update_rsk_tx(
        &self,
        _connection: &mut StorageProcessor<'_>,
        rsk_op_id: RSKOpId,
        new_deadline_block: i64,
        new_gas_value: U256,
    ) -> anyhow::Result<()> {
        let mut rsk_operations = self.rsk_operations.write().await;
        let rsk_op = rsk_operations
            .iter_mut()
            .find(|rsk_op| rsk_op.id == rsk_op_id && !rsk_op.confirmed);

        if let Some(rsk_op) = rsk_op {
            rsk_op.last_deadline_block = new_deadline_block as u64;
            rsk_op.last_used_gas_price = new_gas_value;
        } else {
            panic!("Attempt to update tx that is not unconfirmed");
        }

        Ok(())
    }

    async fn confirm_operation(
        &self,
        _connection: &mut StorageProcessor<'_>,
        hash: &H256,
        _op: &RSKOperation,
    ) -> anyhow::Result<()> {
        let mut rsk_operations = self.rsk_operations.write().await;
        let mut op_idx: Option<i64> = None;
        for operation in rsk_operations.iter_mut() {
            if operation.used_tx_hashes.contains(hash) {
                operation.confirmed = true;
                operation.final_hash = Some(*hash);
                op_idx = Some(operation.id);
                break;
            }
        }

        assert!(
            op_idx.is_some(),
            "Request to confirm operation that was not stored"
        );

        Ok(())
    }

    async fn load_gas_price_limit(
        &self,
        _connection: &mut StorageProcessor<'_>,
    ) -> anyhow::Result<U256> {
        let rsk_parameters = self.rsk_parameters.read().await;
        let gas_price_limit = rsk_parameters.gas_price_limit.into();

        Ok(gas_price_limit)
    }

    async fn load_stats(&self, _connection: &mut StorageProcessor<'_>) -> anyhow::Result<RSKStats> {
        let rsk_parameters = self.rsk_parameters.read().await;
        let eth_stats = RSKStats {
            last_committed_block: rsk_parameters.last_committed_block as usize,
            last_verified_block: rsk_parameters.last_verified_block as usize,
            last_executed_block: rsk_parameters.last_executed_block as usize,
        };

        Ok(eth_stats)
    }

    async fn is_previous_operation_confirmed(
        &self,
        _connection: &mut StorageProcessor<'_>,
        op: &RSKOperation,
    ) -> anyhow::Result<bool> {
        let confirmed = {
            let op = op.op.as_ref().unwrap();
            // We're checking previous block, so for the edge case of first block we can say that previous operation was confirmed.
            let (first_block, _) = op.1.get_block_range();
            if first_block == BlockNumber(1) {
                return Ok(true);
            }

            let rsk_operations = self.rsk_operations.read().await.clone();

            // Consider an operation that affects sequential blocks.
            let maybe_operation = rsk_operations.iter().find(|rsk_operation| {
                let op_block_range = rsk_operation.op.as_ref().unwrap().1.get_block_range();

                op_block_range.1 == first_block - 1
            });

            let operation = match maybe_operation {
                Some(op) => op,
                None => return Ok(false),
            };

            operation.confirmed
        };

        Ok(confirmed)
    }
}

/// Creates a default `RSKParams` for use by mock `RSKSender` .
pub(crate) fn default_eth_parameters() -> RSKParams {
    RSKParams {
        id: true,
        nonce: 0,
        gas_price_limit: 400000000000,
        average_gas_price: None,
        last_committed_block: 0,
        last_verified_block: 0,
        last_executed_block: 0,
    }
}

/// Creates a default `RSKSender` with mock Rootstock connection/database and no operations in DB.
/// Returns the `RSKSender` itself along with communication channels to interact with it.
pub(crate) async fn default_eth_sender() -> RSKSender<MockDatabase> {
    build_eth_sender(
        1,
        Vec::new(),
        Vec::new(),
        Vec::new(),
        default_eth_parameters(),
    )
    .await
}

/// Creates an `RSKSender` with mock Rootstock connection/database and no operations in DB
/// which supports multiple transactions in flight.
/// Returns the `RSKSender` itself along with communication channels to interact with it.
pub(crate) async fn concurrent_eth_sender(max_txs_in_flight: u64) -> RSKSender<MockDatabase> {
    build_eth_sender(
        max_txs_in_flight,
        Vec::new(),
        Vec::new(),
        Vec::new(),
        default_eth_parameters(),
    )
    .await
}

/// Creates an `RSKSender` with mock Rootstock connection/database and restores its state "from DB".
/// Returns the `RSKSender` itself along with communication channels to interact with it.
pub(crate) async fn restored_eth_sender(
    rsk_operations: Vec<RSKOperation>,
    aggregated_operations: Vec<(i64, AggregatedOperation)>,
    unprocessed_operations: Vec<(i64, AggregatedOperation)>,
    rsk_parameters: RSKParams,
) -> RSKSender<MockDatabase> {
    const MAX_TXS_IN_FLIGHT: u64 = 1;

    build_eth_sender(
        MAX_TXS_IN_FLIGHT,
        rsk_operations,
        aggregated_operations,
        unprocessed_operations,
        rsk_parameters,
    )
    .await
}

/// Helper method for configurable creation of `RSKSender`.
async fn build_eth_sender(
    max_txs_in_flight: u64,
    rsk_operations: Vec<RSKOperation>,
    aggregated_operations: Vec<(i64, AggregatedOperation)>,
    unprocessed_operations: Vec<(i64, AggregatedOperation)>,
    rsk_parameters: RSKParams,
) -> RSKSender<MockDatabase> {
    let rootstock = RootstockGateway::Mock(MockRootstock::default());
    let db = MockDatabase::with_restorable_state(
        rsk_operations,
        aggregated_operations,
        unprocessed_operations,
        rsk_parameters,
    );

    let options = RSKSenderConfig {
        sender: Sender {
            max_txs_in_flight,
            expected_wait_time_block: super::EXPECTED_WAIT_TIME_BLOCKS,
            wait_confirmations: super::WAIT_CONFIRMATIONS,
            tx_poll_period: 0,
            is_enabled: true,
            operator_commit_eth_addr: Default::default(),
            operator_private_key: Default::default(),
        },
        gas_price_limit: GasLimit {
            default: 1000,
            sample_interval: 15,
            update_interval: 15,
            scale_factor: 1.0f64,
        },
    };

    RSKSender::new(options, db, rootstock).await
}

/// Behaves the same as `RSKSender::sign_new_tx`, but does not affect nonce.
/// This method should be used to create expected tx copies which won't affect
/// the internal `RSKSender` state.
pub(crate) async fn create_signed_tx(
    id: i64,
    eth_sender: &RSKSender<MockDatabase>,
    aggregated_operation: (i64, AggregatedOperation),
    deadline_block: u64,
    nonce: i64,
) -> RSKOperation {
    let options = Options {
        nonce: Some(nonce.into()),
        ..Default::default()
    };

    let raw_tx = eth_sender.operation_to_raw_tx(&aggregated_operation.1);
    let signed_tx = eth_sender
        .rootstock
        .sign_prepared_tx(raw_tx.clone(), options)
        .await
        .unwrap();

    let op_type = aggregated_operation.1.get_action_type();

    RSKOperation {
        id,
        op_type,
        op: Some(aggregated_operation.clone()),
        nonce: signed_tx.nonce,
        last_deadline_block: deadline_block,
        last_used_gas_price: signed_tx.gas_price,
        used_tx_hashes: vec![signed_tx.hash],
        encoded_tx_data: raw_tx,
        confirmed: false,
        final_hash: None,
    }
}
