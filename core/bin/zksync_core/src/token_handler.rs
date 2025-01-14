//! Token handler is a crate that receives a notification about adding tokens to the contract
//! and adds them to the database.
//!
//! To set the name and the decimals parameter for the token, a match is searched for with the
//! token list (which is taken from the environment). If the token address is not found in the
//! trusted token list, then the default values are used (name = "ERC20-{id}", decimals = 18).

// Built-in deps
use std::collections::HashMap;
// External uses
use futures::{
    channel::{mpsc, oneshot},
    SinkExt,
};
use tokio::task::JoinHandle;
// Workspace uses
use zksync_config::TokenHandlerConfig;
use zksync_notifier::Notifier;
use zksync_storage::{tokens::StoreTokenError, ConnectionPool, StorageProcessor};
use zksync_types::{
    tokens::{NewTokenEvent, Token, TokenInfo},
    Address, TokenId, TokenKind, U256,
};
// Local uses
use crate::eth_watch::EthWatchRequest;
use web3::contract::Options;
use zksync_contracts::erc20_contract;
use zksync_eth_client::RootstockGateway;

struct TokenHandler {
    connection_pool: ConnectionPool,
    poll_interval: std::time::Duration,
    eth_watcher_req: mpsc::Sender<EthWatchRequest>,
    eth_client: RootstockGateway,
    token_list: HashMap<Address, TokenInfo>,
    last_eth_block: Option<u64>,
    notifier: Option<Notifier>,
}

impl TokenHandler {
    fn new(
        connection_pool: ConnectionPool,
        eth_watcher_req: mpsc::Sender<EthWatchRequest>,
        eth_client: RootstockGateway,
        config: TokenHandlerConfig,
    ) -> Self {
        let poll_interval = config.poll_interval();
        let token_list = config
            .token_list()
            .into_iter()
            .map(|token| (token.address, token))
            .collect::<HashMap<Address, TokenInfo>>();

        let webhook_url = reqwest::Url::parse(&config.webhook_url).ok();
        let notifier = webhook_url.map(Notifier::with_mattermost);

        Self {
            connection_pool,
            eth_client,
            token_list,
            poll_interval,
            notifier,
            last_eth_block: None, // TODO: Maybe load last viewed Rootstock block number for TokenHandler from DB (ZKS-518).
            eth_watcher_req,
        }
    }

    async fn load_new_token_events(&self) -> Vec<NewTokenEvent> {
        let (sender, receiver) = oneshot::channel();
        self.eth_watcher_req
            .clone()
            .send(EthWatchRequest::GetNewTokens {
                last_eth_block: self.last_eth_block,
                resp: sender,
            })
            .await
            .expect("ETH watch req receiver dropped");

        receiver.await.expect("Err response from eth watch")
    }

    async fn is_contract_erc20(&self, address: Address) -> bool {
        self.eth_client
            .call_contract_function::<U256, _, _, _>(
                "balanceOf",
                address,
                None,
                Options::default(),
                None,
                address,
                erc20_contract(),
            )
            .await
            .is_ok()
    }

    async fn save_new_tokens(
        &self,
        storage: &mut StorageProcessor<'_>,
        tokens: Vec<NewTokenEvent>,
    ) -> anyhow::Result<Vec<Token>> {
        let mut transaction = storage.start_transaction().await?;
        let mut token_schema = transaction.tokens_schema();

        let last_token_id = TokenId(token_schema.get_max_token_id().await?);
        let mut new_tokens = Vec::new();

        for token_event in tokens {
            if token_event.id.0 <= last_token_id.0 {
                continue;
            }

            // Find a token in the list of trusted tokens
            // or use default values (name = "ERC20-{id}", decimals = 18).
            let default_symbol = format!("ERC20-{}", token_event.id);
            let default_decimals = 18;

            let is_erc20 = self.is_contract_erc20(token_event.address).await;
            let token_kind = if is_erc20 {
                TokenKind::ERC20
            } else {
                TokenKind::None
            };

            let token_from_list = {
                let token_info = self.token_list.get(&token_event.address).cloned();

                if let Some(token_info) = token_info {
                    Some(Token::new(
                        token_event.id,
                        token_info.address,
                        &token_info.symbol,
                        token_info.decimals,
                        token_kind,
                    ))
                } else {
                    None
                }
            };

            let token = match token_from_list {
                Some(token_from_list) => {
                    let try_insert_token = token_schema.store_token(token_from_list.clone()).await;

                    match try_insert_token {
                        Ok(..) => token_from_list,
                        Err(StoreTokenError::TokenAlreadyExistsError(..)) => {
                            // If a token with such parameters already exists in the database
                            // then try insert token with other symbol.
                            let token = Token::new(
                                token_from_list.id,
                                token_from_list.address,
                                &default_symbol,
                                token_from_list.decimals,
                                token_kind,
                            );
                            let try_insert_token = token_schema.store_token(token.clone()).await;
                            match try_insert_token {
                                Ok(..) => (),
                                Err(StoreTokenError::Other(anyhow_err)) => return Err(anyhow_err),
                                Err(StoreTokenError::TokenAlreadyExistsError(err)) => {
                                    vlog::warn!("failed to store token in database: {}", err)
                                }
                            }

                            token
                        }
                        Err(StoreTokenError::Other(anyhow_err)) => return Err(anyhow_err),
                    }
                }
                None => {
                    // Token with default parameters.
                    let token = Token::new(
                        token_event.id,
                        token_event.address,
                        &default_symbol,
                        default_decimals,
                        token_kind,
                    );
                    let try_insert_token = token_schema.store_token(token.clone()).await;
                    match try_insert_token {
                        Ok(..) => (),
                        Err(StoreTokenError::Other(anyhow_err)) => return Err(anyhow_err),
                        Err(StoreTokenError::TokenAlreadyExistsError(err)) => {
                            vlog::warn!("failed to store token in database: {}", err)
                        }
                    }

                    token
                }
            };

            new_tokens.push(token);
        }

        transaction.commit().await?;
        Ok(new_tokens)
    }

    async fn run(&mut self) {
        let mut timer = tokio::time::interval(self.poll_interval);
        loop {
            timer.tick().await;

            let new_tokens_events = self.load_new_token_events().await;

            // Ether is a standard token, so we can assume that at least the last token ID is zero.
            self.last_eth_block = new_tokens_events
                .iter()
                .map(|token| token.eth_block_number)
                .max()
                .or(self.last_eth_block);

            let mut storage = self
                .connection_pool
                .access_storage()
                .await
                .expect("db connection failed for token handler");

            let new_tokens = self
                .save_new_tokens(&mut storage, new_tokens_events)
                .await
                .expect("failed to add tokens to the database");

            // Send a notification that the token has been successfully added to the database.
            if let Some(notifier) = &self.notifier {
                for token in new_tokens {
                    notifier
                        .send_new_token_notify(token)
                        .await
                        .unwrap_or_else(|e| {
                            vlog::error!("Failed to send a token insertion notification: {}", e);
                        });
                }
            }
        }
    }
}

#[must_use]
pub fn run_token_handler(
    db_pool: ConnectionPool,
    eth_client: RootstockGateway,
    config: &TokenHandlerConfig,
    eth_watcher_req: mpsc::Sender<EthWatchRequest>,
) -> JoinHandle<()> {
    let config = config.clone();
    tokio::spawn(async move {
        let mut token_handler =
            TokenHandler::new(db_pool, eth_watcher_req, eth_client, config.clone());

        token_handler.run().await
    })
}
