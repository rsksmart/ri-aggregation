// Built-in uses
use std::time::Duration;
// External uses
use serde::Deserialize;
// Local uses
use crate::envy_load;

/// Configuration for the Rootstock sender crate.
#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct RSKWatchConfig {
    /// Amount of confirmations for the priority operation to be processed.
    /// In production this should be a non-zero value because of block reverts.
    pub confirmations_for_eth_event: u64,
    /// How often we want to poll the Rootstock node.
    /// Value in milliseconds.
    pub eth_node_poll_interval: u64,
}

impl RSKWatchConfig {
    pub fn from_env() -> Self {
        envy_load!("eth_watch", "RSK_WATCH_")
    }

    /// Converts `self.eth_node_poll_interval` into `Duration`.
    pub fn poll_interval(&self) -> Duration {
        Duration::from_millis(self.eth_node_poll_interval)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::configs::test_utils::set_env;

    fn expected_config() -> RSKWatchConfig {
        RSKWatchConfig {
            confirmations_for_eth_event: 0,
            eth_node_poll_interval: 300,
        }
    }

    #[test]
    fn from_env() {
        let config = r#"
RSK_WATCH_CONFIRMATIONS_FOR_RSK_EVENT="0"
RSK_WATCH_RSK_NODE_POLL_INTERVAL="300"
        "#;
        set_env(config);

        let actual = RSKWatchConfig::from_env();
        assert_eq!(actual, expected_config());
    }

    /// Checks the correctness of the config helper methods.
    #[test]
    fn methods() {
        let config = expected_config();

        assert_eq!(
            config.poll_interval(),
            Duration::from_millis(config.eth_node_poll_interval)
        );
    }
}
