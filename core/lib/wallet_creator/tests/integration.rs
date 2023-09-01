use zksync::{
    web3::types::{H160, H256},
    zksync_types::tx::PackedEthSignature,
};

use rif_rollup_wallet_generator_lib::{create_new_wallet, eth_random_account_credentials};

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;

    #[tokio::test]
    #[cfg_attr(not(feature = "integration-tests"), ignore)]
    async fn test_using_random_keys() -> Result<(), anyhow::Error> {
        let eth_address: H160;
        let eth_private_key: H256;
        (eth_address, eth_private_key) = eth_random_account_credentials();
        let wallet = create_new_wallet(
            "localhost",
            format!("{:?}", eth_address).as_str(),
            format!("{:?}", eth_private_key).as_str(),
        )
        .await?;
        println!("-> Wallet created");

        let expected_address =
            PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();
        assert_eq!(wallet.address(), expected_address);
        Ok(())
    }

    #[tokio::test]
    #[cfg_attr(not(feature = "integration-tests"), ignore)]
    async fn test_using_user_address() -> Result<(), anyhow::Error> {
        let eth_private_key: H256 = H256::from_low_u64_be(1_000);

        let eth_address = PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();
        let wallet = create_new_wallet(
            "localhost",
            format!("{:?}", eth_address).as_str(),
            format!("{:?}", eth_private_key).as_str(),
        )
        .await?;
        println!("-> Wallet created");
        let expected_address =
            PackedEthSignature::address_from_private_key(&eth_private_key).unwrap();
        assert_eq!(wallet.address(), expected_address);
        Ok(())
    }
}
