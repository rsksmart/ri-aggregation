pub use crate::configs::{
    ApiConfig, ChainConfig, ContractsConfig, DBConfig, DevLiquidityTokenWatcherConfig,
    RSKClientConfig, RSKSenderConfig, RSKWatchConfig, EventListenerConfig,
    ForcedExitRequestsConfig, GatewayWatcherConfig, MiscConfig, ProverConfig, TickerConfig,
    TokenHandlerConfig,
};

pub mod configs;
pub mod test_config;

#[derive(Debug, Clone)]
pub struct ZkSyncConfig {
    pub api: ApiConfig,
    pub chain: ChainConfig,
    pub contracts: ContractsConfig,
    pub db: DBConfig,
    pub rsk_client: RSKClientConfig,
    pub eth_sender: RSKSenderConfig,
    pub eth_watch: RSKWatchConfig,
    pub token_handler: TokenHandlerConfig,
    pub event_listener: EventListenerConfig,
    pub gateway_watcher: GatewayWatcherConfig,
    pub prover: ProverConfig,
    pub ticker: TickerConfig,
    pub forced_exit_requests: ForcedExitRequestsConfig,
}

impl ZkSyncConfig {
    pub fn from_env() -> Self {
        Self {
            api: ApiConfig::from_env(),
            chain: ChainConfig::from_env(),
            contracts: ContractsConfig::from_env(),
            db: DBConfig::from_env(),
            rsk_client: RSKClientConfig::from_env(),
            eth_sender: RSKSenderConfig::from_env(),
            eth_watch: RSKWatchConfig::from_env(),
            token_handler: TokenHandlerConfig::from_env(),
            event_listener: EventListenerConfig::from_env(),
            gateway_watcher: GatewayWatcherConfig::from_env(),
            prover: ProverConfig::from_env(),
            ticker: TickerConfig::from_env(),
            forced_exit_requests: ForcedExitRequestsConfig::from_env(),
        }
    }
}
