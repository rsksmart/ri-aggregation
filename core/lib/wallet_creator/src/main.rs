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

fn eth_random_account_credentials() -> (H160, H256) {
    let mut eth_private_key = H256::default();
    eth_private_key.randomize();

    let address_from_pk = PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();

    (address_from_pk, eth_private_key)
}

async fn create_new_wallet(address: &str, private_key: &str) -> Result<Wallet<PrivateKeySigner, RpcProvider>, anyhow::Error>{
    let mut eth_address:H160;
    let mut eth_private_key:H256;
    if address.is_empty() || key.is_empty() {
        (eth_address, eth_private_key) = eth_random_account_credentials();
    } else {
        eth_address = address.parse().unwrap();
        eth_private_key = private_key.parse().unwrap();
    }

    println!("-> Address {:?}", eth_address);
    println!("-> Private key {:?}", eth_private_key);

    let eth_signer = PrivateKeySigner::new(eth_private_key);
    let credentials =
        WalletCredentials::from_eth_signer(eth_address, eth_signer, Network::Localhost)
            .await
            .unwrap();

    let provider = RpcProvider::new(Network::Localhost);
    let wallet = Wallet::new(provider, credentials).await?;


    Ok(wallet)
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args: Vec<String> = env::args().collect();

    let mut address: &str = "";
    let mut key: &str = "";

    if args.len() > 3 {
        address = &args[2];
        key = &args[3];

        println!("Address and key supplied will be used");
    } else {
        println!("No address and key supplied. Random will be generated");
    }
    
    let _wallet = create_new_wallet(address, key).await?;
    println!("-> Wallet created");

    Ok(())
}