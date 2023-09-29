// Built-in uses
use std::time::Duration;
// External uses
use serde::Deserialize;
// Workspace uses
use zksync_types::{network::Network, Address, H256};
// Local uses
use crate::{configs::chain::Eth, envy_load, ETHClientConfig};

/// Configuration for the Rootstock sender crate.
#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct ETHSenderConfig {
    /// Options related to the Rootstock sender directly.
    pub sender: Sender,
    /// Options related to the `gas_adjuster` submodule.
    pub gas_price_limit: GasLimit,
}

impl ETHSenderConfig {
    pub fn from_env() -> Self {
        let eth: Eth = envy_load!("eth", "CHAIN_ETH_");
        let sender: Sender = envy_load!("eth_sender", "ETH_SENDER_SENDER_");
        let client: ETHClientConfig = envy_load!("eth_client", "ETH_CLIENT_");

        assert!(
            !(sender.complete_withdrawals
                && (eth.network == Network::Mainnet || client.chain_id == 30)),
            "The withdrawals cannot be automatic in mainnet"
        );

        Self {
            sender,
            gas_price_limit: envy_load!(
                "eth_sender.gas_price_limit",
                "ETH_SENDER_GAS_PRICE_LIMIT_"
            ),
        }
    }
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct Sender {
    /// Private key of the operator account.
    pub operator_private_key: H256,
    /// Address of the operator account.
    pub operator_commit_eth_addr: Address,
    /// mount of confirmations required to consider L1 transaction committed.
    pub wait_confirmations: u64,
    /// Amount of blocks we will wait before considering L1 transaction stuck.
    pub expected_wait_time_block: u64,
    /// Node polling period in seconds.
    pub tx_poll_period: u64,
    /// The maximum amount of simultaneously sent Rootstock transactions.
    pub max_txs_in_flight: u64,
    /// Whether sender should interact with L1 or not.
    pub is_enabled: bool,
    /// Automatic withdrawals in execute aggregated operation
    pub complete_withdrawals: bool,
}

impl Sender {
    /// Converts `self.tx_poll_period` into `Duration`.
    pub fn tx_poll_period(&self) -> Duration {
        Duration::from_secs(self.tx_poll_period)
    }
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct GasLimit {
    /// Gas price limit to be used by GasAdjuster until the statistics data is gathered.
    pub default: u64,
    /// Interval between updates of the gas price limit (used by GasAdjuster) in seconds.
    pub update_interval: u64,
    /// Interval between adding the Rootstock node gas price to the GasAdjuster in seconds.
    pub sample_interval: u64,
    /// Scale factor for gas price limit (used by GasAdjuster).
    pub scale_factor: f64,
}

impl GasLimit {
    /// Converts `self.update_interval` into `Duration`.
    pub fn update_interval(&self) -> Duration {
        Duration::from_secs(self.update_interval)
    }

    /// Converts `self.sample_interval` into `Duration`.
    pub fn sample_interval(&self) -> Duration {
        Duration::from_secs(self.sample_interval)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configs::test_utils::{addr, hash, set_env};

    fn expected_config() -> ETHSenderConfig {
        ETHSenderConfig {
            sender: Sender {
                wait_confirmations: 1,
                expected_wait_time_block: 30,
                tx_poll_period: 3,
                max_txs_in_flight: 3,
                is_enabled: true,
                operator_private_key: hash(
                    "c1783a9a8222e47778911c58bb5aac1343eb425159ff140799e0a283bfb8fa16",
                ),
                operator_commit_eth_addr: addr("debe71e1de41fc77c44df4b6db940026e31b0e71"),
                complete_withdrawals: false,
            },
            gas_price_limit: GasLimit {
                default: 400000000000,
                update_interval: 150,
                sample_interval: 15,
                scale_factor: 1.0f64,
            },
        }
    }

    #[test]
    fn from_env() {
        let config = r#"
ETH_SENDER_SENDER_WAIT_CONFIRMATIONS="1"
ETH_SENDER_SENDER_EXPECTED_WAIT_TIME_BLOCK="30"
ETH_SENDER_SENDER_TX_POLL_PERIOD="3"
ETH_SENDER_SENDER_MAX_TXS_IN_FLIGHT="3"
ETH_SENDER_SENDER_IS_ENABLED="true"
ETH_SENDER_SENDER_COMPLETE_WITHDRAWALS="false"
ETH_SENDER_SENDER_OPERATOR_PRIVATE_KEY="0xc1783a9a8222e47778911c58bb5aac1343eb425159ff140799e0a283bfb8fa16"
ETH_SENDER_SENDER_OPERATOR_COMMIT_ETH_ADDR="0xdebe71e1de41fc77c44df4b6db940026e31b0e71"
ETH_SENDER_GAS_PRICE_LIMIT_DEFAULT="400000000000"
ETH_SENDER_GAS_PRICE_LIMIT_UPDATE_INTERVAL="150"
ETH_SENDER_GAS_PRICE_LIMIT_SAMPLE_INTERVAL="15"
ETH_SENDER_GAS_PRICE_LIMIT_SCALE_FACTOR="1"
CHAIN_ETH_NETWORK="mainnet"
ETH_CLIENT_CHAIN_ID=30
ETH_CLIENT_GAS_PRICE_FACTOR="1"
ETH_CLIENT_WEB3_URL="http://127.0.0.1:4444"
        "#;
        set_env(config);

        let actual = ETHSenderConfig::from_env();
        assert_eq!(actual, expected_config());
    }

    /// Checks the correctness of the config helper methods.
    #[test]
    fn methods() {
        let config = expected_config();

        assert_eq!(
            config.sender.tx_poll_period(),
            Duration::from_secs(config.sender.tx_poll_period)
        );

        assert_eq!(
            config.gas_price_limit.update_interval(),
            Duration::from_secs(config.gas_price_limit.update_interval)
        );
        assert_eq!(
            config.gas_price_limit.sample_interval(),
            Duration::from_secs(config.gas_price_limit.sample_interval)
        );
    }

    #[test]
    #[should_panic(expected = "The withdrawals cannot be automatic in mainnet")]
    fn from_env_mainnet() {
        let config = r#"
ETH_SENDER_SENDER_WAIT_CONFIRMATIONS="1"
ETH_SENDER_SENDER_EXPECTED_WAIT_TIME_BLOCK="30"
ETH_SENDER_SENDER_TX_POLL_PERIOD="3"
ETH_SENDER_SENDER_MAX_TXS_IN_FLIGHT="3"
ETH_SENDER_SENDER_IS_ENABLED="true"
ETH_SENDER_SENDER_COMPLETE_WITHDRAWALS="true"
ETH_SENDER_SENDER_OPERATOR_PRIVATE_KEY="0xc1783a9a8222e47778911c58bb5aac1343eb425159ff140799e0a283bfb8fa16"
ETH_SENDER_SENDER_OPERATOR_COMMIT_ETH_ADDR="0xdebe71e1de41fc77c44df4b6db940026e31b0e71"
ETH_SENDER_GAS_PRICE_LIMIT_DEFAULT="400000000000"
ETH_SENDER_GAS_PRICE_LIMIT_UPDATE_INTERVAL="150"
ETH_SENDER_GAS_PRICE_LIMIT_SAMPLE_INTERVAL="15"
ETH_SENDER_GAS_PRICE_LIMIT_SCALE_FACTOR="1"
CHAIN_ETH_NETWORK="mainnet"
ETH_CLIENT_CHAIN_ID=30
ETH_CLIENT_GAS_PRICE_FACTOR="1"
ETH_CLIENT_WEB3_URL="http://127.0.0.1:4444"
        "#;
        set_env(config);

        ETHSenderConfig::from_env();
    }
}
