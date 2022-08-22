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
    let eth_address:H160;
    let eth_private_key:H256;
    if address.is_empty() || private_key.is_empty() {
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

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    // use serde_json as ser;

    #[test]
    fn test_generate_random_keys() {
        // assert_eq!(add(1, 2), 3);
        let eth_address:H160;
        let eth_private_key:H256;
        (eth_address, eth_private_key) = eth_random_account_credentials();

        println!("-> Address {:?}", eth_address);
        println!("-> Private key {:?}", eth_private_key);    

        assert_eq!(eth_address.is_zero(), false);
        assert_eq!(eth_private_key.is_zero(), false);
    }

    #[tokio::test]
    async fn test_using_random_keys() -> Result<(), anyhow::Error>  {
        let eth_address:H160;
        let eth_private_key:H256;
        (eth_address, eth_private_key) = eth_random_account_credentials();
        let _wallet = create_new_wallet(format!("{:?}",eth_address).as_str(), format!("{:?}",eth_private_key).as_str()).await?;
        println!("-> Wallet created");
        assert_eq!(1,1);
        Ok(())
    }

    #[tokio::test]
    async fn test_using_user_address() -> Result<(), anyhow::Error>  {
        // assert_eq!(bad_add(1, 2), 3);
        let eth_private_key:H256 = H256::from_low_u64_be(1_000);

        let eth_address = PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();
        let _wallet = create_new_wallet(format!("{:?}",eth_address).as_str(), format!("{:?}",eth_private_key).as_str()).await?;
        println!("-> Wallet created");
        assert_eq!(1,1);
        Ok(())
    }
}