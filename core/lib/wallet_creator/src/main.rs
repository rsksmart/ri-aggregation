use std::{env};

use zksync::{
    web3::{
        types::{H160, H256},
    },
    zksync_types::{
        tx::PackedEthSignature,
    },
    Network, RpcProvider, Wallet, WalletCredentials,
};

use zksync_eth_signer::{PrivateKeySigner};

// const ETH_ADDR: &str = "c354d97642faa06781b76ffb6786f72cd7746c97";
// const ETH_PRIVATE_KEY: &str = "20e4a6381bd3826a14f8da63653d94e7102b38eb5f929c7a94652f41fa7ba323";
// const LOCALHOST_WEB3_ADDR: &str = "http://127.0.0.1:4444";
// const DOCKER_WEB3_ADDR: &str = "http://rskj:4444"; 

fn eth_random_account_credentials() -> (H160, H256) {
    let mut eth_private_key = H256::default();
    eth_private_key.randomize();

    let address_from_pk = PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();

    (address_from_pk, eth_private_key)
}

async fn create_new_wallet() -> Result<Wallet<PrivateKeySigner, RpcProvider>, anyhow::Error>{
    let (eth_address, eth_private_key) = eth_random_account_credentials();
    println!("Private key: {:?}",eth_private_key);

    let provider = RpcProvider::new(Network::Localhost);

    let eth_signer = PrivateKeySigner::new(eth_private_key);
    let credentials =
        WalletCredentials::from_eth_signer(eth_address, eth_signer, Network::Localhost)
            .await
            .unwrap();

    let wallet = Wallet::new(provider, credentials).await?;

    Ok(wallet)
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let _wallet = create_new_wallet().await?;
    // print!("well well well");
    Ok(())
}