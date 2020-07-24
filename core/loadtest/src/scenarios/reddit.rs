//! Loadtest scenario for the Reddit PoC.
//!
//! This test runs the following operations:
//!
//! - 100,000 point claims (minting & distributing points) (i.e. transfers — AG)
//! - 25,000 subscriptions (i.e. creating subscriptions; this can be done fully offchain — AG)
//! - 75,000 one-off points burning (i.e. subscription redemptions: — AG)
//! - 100,000 transfers

// Scenario logic:
// - Create 25.000 users (via change pubkey op)
// - Execute 4 minting txs per user (total of 100.000)
// - Subscribe every user to the community (25.000 subscriptions)
// - Create 3 burning txs per user (75.000 burning txs)
// - Create 4 transfers per user (100.000 transfers)
// Additional: measure time to run the test.

// Built-in deps
use std::{iter::Iterator, time::Duration};
// External deps
use chrono::Utc;
use futures::future::try_join_all;
use num::BigUint;
use tokio::fs;
use web3::{
    transports::{EventLoopHandle, Http},
    types::H256,
};
// Workspace deps
use models::node::{closest_packable_fee_amount, tx::PackedEthSignature, FranklinTx, PrivateKey};
use testkit::zksync_account::ZksyncAccount;
// Local deps
use crate::{
    rpc_client::RpcClient,
    scenarios::{configs::RedditConfig, utils::wait_for_commit, ScenarioContext},
    test_accounts::TestAccount,
};

const N_ACCOUNTS: usize = 25_000;

#[derive(Debug)]
struct ScenarioExecutor {
    rpc_client: RpcClient,

    /// Genesis account to mint tokens from.
    genesis_account: TestAccount,

    /// Burn account: account to which burned tokens are sent.
    burn_account: ZksyncAccount,

    /// ID and symbol of used token (e.g. `(0, "ETH")`).
    token: (u16, String),

    /// Intermediate account to rotate funds within.
    accounts: Vec<ZksyncAccount>,

    /// Amount of time to wait for one zkSync block to be verified.
    verify_timeout: Duration,

    /// Event loop handle so transport for Eth account won't be invalidated.
    _event_loop_handle: EventLoopHandle,
}

impl ScenarioExecutor {
    /// Creates a real-life scenario executor.
    pub fn new(ctx: &ScenarioContext, rpc_client: RpcClient) -> Self {
        // Load the config for the test from JSON file.
        let config = RedditConfig::load(&ctx.config_path);

        // Create a transport for Ethereum account.
        let (_event_loop_handle, transport) =
            Http::new(&ctx.options.web3_url).expect("http transport start");

        // Create genesis account to mint tokens from.
        let genesis_account =
            TestAccount::from_info(&config.genesis_account, &transport, &ctx.options);

        // Create a burn account to burn tokens.
        let burn_account = ZksyncAccount::rand();

        // Generate random accounts to rotate funds within.
        let accounts = (0..N_ACCOUNTS).map(|_| ZksyncAccount::rand()).collect();

        let verify_timeout = Duration::from_secs(config.block_timeout);

        Self {
            rpc_client,

            genesis_account,
            burn_account,
            accounts,
            verify_timeout,
            token: (config.token_id, config.token_name),

            _event_loop_handle,
        }
    }

    /// Infallible test runner which performs the emergency exit if any step of the test
    /// fails.
    pub async fn run(&mut self) {
        if let Err(error) = self.run_test().await {
            log::error!("Loadtest erred with the following error: {}", error);
        } else {
            log::info!("Loadtest completed successfully");
        }
    }

    /// Method to be used before the scenario.
    /// It stores all the zkSync account keys into a file named
    /// like "loadtest_accounts_2020_05_05_12_23_55.txt"
    /// so the funds left on accounts will not be lost.
    ///
    /// If saving the file fails, the accounts are printed to the log.
    async fn save_accounts(&self) {
        // Timestamp is used to generate unique file name postfix.
        let timestamp = Utc::now();
        let timestamp_str = timestamp.format("%Y_%m_%d_%H_%M_%S").to_string();

        let output_file_name = format!("reddit_accounts_{}.txt", timestamp_str);

        let mut account_list = String::new();

        // Add all the accounts to the string.
        // Debug representations of account contains both zkSync and Ethereum private keys.
        for account in self.accounts.iter() {
            account_list += &format!("{:?}\n", account);
        }

        // If we're unable to save the file, print its contents to the console at least.
        if let Err(error) = fs::write(&output_file_name, &account_list).await {
            log::error!(
                "Storing the account list erred with the following error: {}",
                error
            );
            log::warn!(
                "Printing the account list to the log instead: \n{}",
                account_list
            )
        } else {
            log::info!(
                "Accounts used in this test are saved to the file '{}'",
                &output_file_name
            );
        }
    }

    /// Runs the test step-by-step. Every test step is encapsulated into its own function.
    pub async fn run_test(&mut self) -> Result<(), failure::Error> {
        self.save_accounts().await;

        self.initialize().await?;

        let account_futures: Vec<_> = (0..N_ACCOUNTS)
            .map(|account_id| self.one_account_run(account_id))
            .collect();

        try_join_all(account_futures).await?;

        // After executing these futures we must send one more (random) tx and wait it to be
        // verified. The verification will mean that all the previously sent txs are verified as well.
        // After that, we may check the balances of every account to check if all the txs were executed
        // successfully.

        self.finish().await?;

        Ok(())
    }

    /// Initializes the test, preparing the main account for the interaction.
    async fn initialize(&mut self) -> Result<(), failure::Error> {
        Ok(())
    }

    async fn one_account_run(&self, account_id: usize) -> Result<(), failure::Error> {
        const N_MINT_OPS: usize = 4;
        const N_SUBSCRIPTIONS: usize = 1;
        const N_BURN_FUNDS_OPS: usize = 3;
        const N_TRANSFER_OPS: usize = 4;

        let account = &self.accounts[account_id];

        self.initialize_account(account).await?;

        for _ in 0..N_MINT_OPS {
            self.mint_tokens(account).await?
        }

        for _ in 0..N_SUBSCRIPTIONS {
            self.subscribe(account).await?
        }

        for _ in 0..N_BURN_FUNDS_OPS {
            self.burn_funds(account).await?
        }

        for _ in 0..N_TRANSFER_OPS {
            self.transfer_funds(account).await?
        }

        Ok(())
    }

    async fn initialize_account(&self, account: &ZksyncAccount) -> Result<(), failure::Error> {
        // 1. Send the `ChangePubKey` tx to add the account to the tree (this behavior must be implemented beforehand).
        // Note: This currently won't work, as now account ID has to exist *before* sending the `ChangePubKey`.
        let change_pubkey_tx =
            FranklinTx::ChangePubKey(Box::new(account.create_change_pubkey_tx(None, true, false)));

        let tx_hash = self.rpc_client.send_tx(change_pubkey_tx, None).await?;

        wait_for_commit(tx_hash, Duration::from_secs(60), &self.rpc_client).await?;

        // 2. Set the account ID (required for transfers).
        let resp = self
            .rpc_client
            .account_state_info(account.address)
            .await
            .expect("rpc error");
        assert!(resp.id.is_some(), "Account ID is none for new account");
        account.set_account_id(resp.id);

        Ok(())
    }

    async fn mint_tokens(&self, account: &ZksyncAccount) -> Result<(), failure::Error> {
        const MINT_SIZE: u64 = 100; // 100 tokens for everybody.

        // 1. Create a minting tx, signed by both participants.
        let from_acc = &self.genesis_account.zk_acc;
        let to_acc = account;

        let fee = self.transfer_fee(&to_acc).await;
        let mint_tx = self.sign_transfer_from(from_acc, to_acc, MINT_SIZE, fee);

        // 2. Send the tx.
        let tx_hash = self.rpc_client.send_tx(mint_tx, None).await?;

        // 3. Wait for it to be executed.
        wait_for_commit(tx_hash, Duration::from_secs(60), &self.rpc_client).await?;

        Ok(())
    }

    async fn subscribe(&self, account: &ZksyncAccount) -> Result<(), failure::Error> {
        const COMMUNITY_NAME: &str = "TestCommunity";
        const SUBSCRIPTION_COST: u64 = 1;

        // 1. Create a subscription account.
        let subscription_wallet = self.create_subscription_account(account, COMMUNITY_NAME);
        self.initialize_account(&subscription_wallet).await?;

        // 2. Create a TransferFrom tx.
        let from_acc = account;
        let to_acc = &subscription_wallet;

        let fee = self.transfer_fee(&to_acc).await;
        let transfer_from_tx = self.sign_transfer_from(from_acc, to_acc, SUBSCRIPTION_COST, fee);

        // 3. Create a Burn tx
        let from_acc = &subscription_wallet;
        let to_acc = &self.burn_account;

        let fee = self.transfer_fee(&to_acc).await;
        let (burn_tx, burn_eth_sign) = self.sign_transfer(from_acc, to_acc, SUBSCRIPTION_COST, fee);

        // 4. Send both txs in a bundle.
        // TODO: txs currently sent not together
        let tx_hash_1 = self.rpc_client.send_tx(transfer_from_tx, None).await?;
        let tx_hash_2 = self.rpc_client.send_tx(burn_tx, burn_eth_sign).await?;

        // 5. Wait for txs to be executed.
        wait_for_commit(tx_hash_1, Duration::from_secs(60), &self.rpc_client).await?;
        wait_for_commit(tx_hash_2, Duration::from_secs(60), &self.rpc_client).await?;

        Ok(())
    }

    async fn burn_funds(&self, account: &ZksyncAccount) -> Result<(), failure::Error> {
        const BURN_SIZE: u64 = 1; // Burn 1 token at a time.

        // 1. Create a minting tx, signed by both participants.
        let from_acc = account;
        let to_acc = &self.burn_account;

        let fee = self.transfer_fee(&to_acc).await;
        let (burn_tx, eth_sign) = self.sign_transfer(from_acc, to_acc, BURN_SIZE, fee);

        // 2. Send the tx.
        let tx_hash = self.rpc_client.send_tx(burn_tx, eth_sign).await?;

        // 3. Wait for it to be executed.
        wait_for_commit(tx_hash, Duration::from_secs(60), &self.rpc_client).await?;

        Ok(())
    }

    async fn transfer_funds(&self, account: &ZksyncAccount) -> Result<(), failure::Error> {
        const TRANSFER_SIZE: u64 = 1; // Send 1 token.

        // 1. Create a transfer tx (to self for simplicity).
        let from_acc = account;
        let to_acc = account;

        let fee = self.transfer_fee(account).await;
        let (tx, eth_sign) = self.sign_transfer(from_acc, to_acc, TRANSFER_SIZE, fee);

        // 2. Send the tx.
        let tx_hash = self
            .rpc_client
            .send_tx(tx.clone(), eth_sign.clone())
            .await?;

        // 3. Wait for it to be executed.
        wait_for_commit(tx_hash, Duration::from_secs(60), &self.rpc_client).await?;

        Ok(())
    }

    async fn finish(&mut self) -> Result<(), failure::Error> {
        Ok(())
    }

    /// Obtains a fee required for the transfer operation.
    async fn transfer_fee(&self, to_acc: &ZksyncAccount) -> BigUint {
        let fee = self
            .rpc_client
            .get_tx_fee("Transfer", to_acc.address, "ETH")
            .await
            .expect("Can't get tx fee");

        closest_packable_fee_amount(&fee)
    }

    /// Creates a signed transfer transaction.
    /// Sender and receiver are chosen from the generated
    /// accounts, determined by its indices.
    fn sign_transfer(
        &self,
        from: &ZksyncAccount,
        to: &ZksyncAccount,
        amount: impl Into<BigUint>,
        fee: impl Into<BigUint>,
    ) -> (FranklinTx, Option<PackedEthSignature>) {
        let (tx, eth_signature) = from.sign_transfer(
            self.token.0,
            &self.token.1,
            amount.into(),
            fee.into(),
            &to.address,
            None,
            true,
        );

        (FranklinTx::Transfer(Box::new(tx)), Some(eth_signature))
    }

    /// Creates a signed TransferFrom transaction. Transaction will be signed by both participants of
    /// the transfer.
    /// Ethereum signature is not required for this operation
    fn sign_transfer_from(
        &self,
        from: &ZksyncAccount,
        to: &ZksyncAccount,
        amount: impl Into<BigUint>,
        fee: impl Into<BigUint>,
    ) -> FranklinTx {
        // TODO: Stub

        let (tx, _eth_signature) = from.sign_transfer(
            self.token.0,
            &self.token.1,
            amount.into(),
            fee.into(),
            &to.address,
            None,
            true,
        );

        FranklinTx::Transfer(Box::new(tx))
    }

    fn create_subscription_account(
        &self,
        account: &ZksyncAccount,
        community_name: &str,
    ) -> ZksyncAccount {
        let mut sk_bytes = [0u8; 32];
        account
            .private_key
            .write(&mut sk_bytes[..])
            .expect("Can't write the private key");
        let seed = format!("{}reddit.com/r/{}", hex::encode(&sk_bytes), community_name);
        let private_key_bytes = private_key_from_seed(seed.as_ref());

        let zk_private_key =
            PrivateKey::read(&private_key_bytes[..]).expect("Can't read private key [zk]");
        let eth_private_key = H256::from_slice(&private_key_bytes[..]);

        let address = PackedEthSignature::address_from_private_key(&eth_private_key)
            .expect("Can't get the address from private key");

        ZksyncAccount::new(zk_private_key, Default::default(), address, eth_private_key)
    }
}

/// Deterministic algorithm to generate a private key for subscription.
/// This implementation is copied from the `zksync-crypto` crate to completely
/// match the function used in the js on the client side.
fn private_key_from_seed(seed: &[u8]) -> Vec<u8> {
    pub use crypto_exports::franklin_crypto::bellman::pairing::bn256::{Bn256 as Engine, Fr};
    use crypto_exports::franklin_crypto::{
        alt_babyjubjub::fs::FsRepr,
        bellman::pairing::ff::{PrimeField, PrimeFieldRepr},
        jubjub::JubjubEngine,
    };
    use sha2::{Digest, Sha256};
    pub type Fs = <Engine as JubjubEngine>::Fs;

    if seed.len() < 32 {
        panic!("Seed is too short");
    };

    let sha256_bytes = |input: &[u8]| -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.input(input);
        hasher.result().to_vec()
    };

    let mut effective_seed = sha256_bytes(seed);

    loop {
        let raw_priv_key = sha256_bytes(&effective_seed);
        let mut fs_repr = FsRepr::default();
        fs_repr
            .read_be(&raw_priv_key[..])
            .expect("failed to read raw_priv_key");
        if Fs::from_repr(fs_repr).is_ok() {
            return raw_priv_key;
        } else {
            effective_seed = raw_priv_key;
        }
    }
}

/// Runs the real-life test scenario.
/// For description, see the module doc-comment.
pub fn run_scenario(mut ctx: ScenarioContext) {
    let rpc_addr = ctx.rpc_addr.clone();
    let rpc_client = RpcClient::new(&rpc_addr);

    let mut scenario = ScenarioExecutor::new(&ctx, rpc_client);

    // Run the scenario.
    log::info!("Starting the real-life test");
    ctx.rt.block_on(scenario.run());
}
