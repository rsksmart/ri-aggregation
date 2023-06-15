use crate::register_factory_handler::run_register_factory_handler;
use crate::state_keeper::ZkSyncStateInitParams;
use crate::{
    committer::run_committer,
    eth_watch::start_eth_watch,
    state_keeper::{start_root_hash_calculator, start_state_keeper, ZkSyncStateKeeper},
    token_handler::run_token_handler,
};
use futures::{channel::mpsc, future};
use tokio::task::JoinHandle;
use zksync_config::{ChainConfig, ZkSyncConfig};
use zksync_mempool::{run_mempool_block_handler, run_mempool_tx_handler};
use zksync_rsk_client::RootstockGateway;
use zksync_storage::ConnectionPool;
use zksync_types::{tokens::get_genesis_token_list, Token, TokenId, TokenKind};

const DEFAULT_CHANNEL_CAPACITY: usize = 32_768;

pub mod committer;
pub mod eth_watch;
pub mod register_factory_handler;
pub mod rejected_tx_cleaner;
pub mod state_keeper;
pub mod token_handler;
pub mod tx_event_emitter;

mod genesis;
mod private_api;

/// Waits for any of the tokio tasks to be finished.
/// Since the main tokio tasks are used as actors which should live as long
/// as application runs, any possible outcome (either `Ok` or `Err`) is considered
/// as a reason to stop the server completely.
pub async fn wait_for_tasks(task_futures: Vec<JoinHandle<()>>) {
    match future::select_all(task_futures).await {
        (Ok(_), _, _) => {
            panic!("One of the actors finished its run, while it wasn't expected to do it");
        }
        (Err(error), _, _) => {
            vlog::warn!("One of the tokio actors unexpectedly finished, shutting down");
            if error.is_panic() {
                // Resume the panic on the main task
                std::panic::resume_unwind(error.into_panic());
            }
        }
    }
}

/// Inserts the initial information about zkSync tokens into the database.
pub async fn genesis_init(config: &ChainConfig) {
    let pool = ConnectionPool::new(Some(1));

    vlog::info!("Generating genesis block.");
    genesis::create_genesis_block(pool.clone(), &config.state_keeper.fee_account_addr).await;
    vlog::info!("Adding initial tokens to db");
    let genesis_tokens = get_genesis_token_list(&config.eth.network.to_string())
        .expect("Initial token list not found");
    for (id, token) in (1..).zip(genesis_tokens) {
        vlog::info!(
            "Adding token: {}, id:{}, address: {}, decimals: {}",
            token.symbol,
            id,
            token.address,
            token.decimals
        );
        pool.access_storage()
            .await
            .expect("failed to access db")
            .tokens_schema()
            .store_token(Token::new(
                TokenId(id as u32),
                token.address,
                &token.symbol,
                token.decimals,
                TokenKind::ERC20,
            ))
            .await
            .expect("failed to store token");
    }
}

/// Starts the core application, which has the following sub-modules:
///
/// - Rootstock Watcher, module to monitor on-chain operations.
/// - zkSync state keeper, module to execute and seal blocks.
/// - mempool, module to organize incoming transactions.
/// - block proposer, module to create block proposals for state keeper.
/// - committer, module to store pending and completed blocks into the database.
/// - private Core API server.
pub async fn run_core(
    connection_pool: ConnectionPool,
    read_only_connection_pool: ConnectionPool,
    config: &ZkSyncConfig,
    eth_gateway: RootstockGateway,
) -> anyhow::Result<Vec<JoinHandle<()>>> {
    let (proposed_blocks_sender, proposed_blocks_receiver) =
        mpsc::channel(DEFAULT_CHANNEL_CAPACITY);
    let (eth_watch_req_sender, eth_watch_req_receiver) = mpsc::channel(DEFAULT_CHANNEL_CAPACITY);
    let (mempool_tx_request_sender, mempool_tx_request_receiver) =
        mpsc::channel(DEFAULT_CHANNEL_CAPACITY);
    let (mempool_block_request_sender, mempool_block_request_receiver) =
        mpsc::channel(DEFAULT_CHANNEL_CAPACITY);

    let (processed_tx_events_sender, processed_tx_events_receiver) =
        mpsc::channel(DEFAULT_CHANNEL_CAPACITY);

    let mempool_tx_handler_task = run_mempool_tx_handler(
        connection_pool.clone(),
        mempool_tx_request_receiver,
        config.chain.state_keeper.block_chunk_sizes.clone(),
    );

    // Run health check api for core
    let private_api_task = private_api::start_private_core_api(
        connection_pool.clone(),
        read_only_connection_pool,
        eth_gateway.clone(),
        config.api.private.clone(),
    );

    // Start Rootstock Watcher.
    let eth_watch_task = start_eth_watch(
        eth_watch_req_sender.clone(),
        eth_watch_req_receiver,
        eth_gateway.clone(),
        &config.contracts,
        &config.eth_watch,
        mempool_tx_request_sender.clone(),
    )
    .await;

    // Insert pending withdrawals into database (if required)
    let mut storage_processor = connection_pool.access_storage().await?;

    // Start state keeper and root hash calculator.
    let state_keeper_init = ZkSyncStateInitParams::restore_from_db(
        &mut storage_processor,
        config.chain.state_keeper.fee_account_addr,
        &config.chain.state_keeper.block_chunk_sizes,
    )
    .await;

    let (mut state_keeper, root_hash_calculator) = ZkSyncStateKeeper::new(
        state_keeper_init,
        config.chain.state_keeper.fee_account_addr,
        proposed_blocks_sender,
        mempool_block_request_sender,
        config.chain.state_keeper.block_chunk_sizes.clone(),
        config.chain.state_keeper.miniblock_iterations as usize,
        config.chain.state_keeper.fast_block_miniblock_iterations as usize,
        processed_tx_events_sender,
    );

    // Execute reverted blocks before start
    state_keeper.execute_reverted_blocks().await;

    let state_keeper_task = start_state_keeper(
        state_keeper,
        config.chain.state_keeper.miniblock_iteration_interval(),
    );
    let root_hash_calculator_task = start_root_hash_calculator(root_hash_calculator);

    // Start committer.
    let committer_task = run_committer(
        proposed_blocks_receiver,
        connection_pool.clone(),
        config.chain.clone(),
    );

    // Start mempool.
    let mempool_block_handler_task = run_mempool_block_handler(
        connection_pool.clone(),
        mempool_block_request_receiver,
        config.chain.state_keeper.block_chunk_sizes.clone(),
    );

    // Start token handler.
    let token_handler_task = run_token_handler(
        connection_pool.clone(),
        eth_gateway.clone(),
        &config.token_handler,
        eth_watch_req_sender.clone(),
    );

    // Start token handler.
    let register_factory_task = run_register_factory_handler(
        connection_pool.clone(),
        eth_watch_req_sender.clone(),
        config.token_handler.clone(),
    );

    let tx_event_emitter_task = tx_event_emitter::run_tx_event_emitter_task(
        connection_pool.clone(),
        processed_tx_events_receiver,
    );

    let task_futures = vec![
        eth_watch_task,
        state_keeper_task,
        root_hash_calculator_task,
        committer_task,
        token_handler_task,
        register_factory_task,
        tx_event_emitter_task,
        mempool_block_handler_task,
        mempool_tx_handler_task,
        private_api_task,
    ];

    Ok(task_futures)
}
