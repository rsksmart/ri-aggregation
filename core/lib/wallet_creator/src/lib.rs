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

pub fn eth_random_account_credentials() -> (H160, H256) {
    let mut eth_private_key = H256::default();
    eth_private_key.randomize();

    let address_from_pk = PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();

    (address_from_pk, eth_private_key)
}

pub async fn create_new_wallet(network: &str, address: &str, private_key: &str) -> Result<Wallet<PrivateKeySigner, RpcProvider>, anyhow::Error>{
    let eth_address:H160;
    let eth_private_key:H256;

    let network_provider: Network = match network {
        "localhost" => Network::Localhost,
        "mainnet" => Network::Mainnet,
        "testnet" => Network::Testnet,
        &_ => todo!(),
    };
    
    if address.is_empty() || private_key.is_empty() {
        (eth_address, eth_private_key) = eth_random_account_credentials();
    } else {
        eth_address = address.parse().unwrap();
        eth_private_key = private_key.parse().unwrap();
    }

    println!("-> Address {:?}", eth_address);
    println!("-> L1 Private key {:?}", eth_private_key);

    let eth_signer = PrivateKeySigner::new(eth_private_key);
    let credentials =
        WalletCredentials::from_eth_signer(eth_address, eth_signer, network_provider)
            .await
            .unwrap();

    let provider = RpcProvider::new(network_provider);
    let wallet = Wallet::new(provider, credentials).await?;

    println!("-> L2 PrivateKey {}", wallet.signer.get_zk_private_key());

    Ok(wallet)
}