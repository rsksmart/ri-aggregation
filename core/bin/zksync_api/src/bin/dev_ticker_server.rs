use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use providers::{
    dev_liquidity_provider, dev_price_provider, proxy_liquidity_provider, proxy_price_provider,
    proxy_utils::ProxyState,
};
use std::{
    collections::HashMap,
    fs::read_to_string,
    path::{Path, PathBuf},
};
use structopt::StructOpt;
use tokio::sync::Mutex;
use zksync_config::ChainConfig;
use zksync_types::{network::Network, TokenInfo};
use zksync_utils::parse_env;

mod providers;

#[derive(Debug, StructOpt, Clone, Copy)]
struct FeeTickerOpts {
    /// Activate "sloppy" mode.
    ///
    /// With the option, server will provide a random delay for requests
    /// (60% of 0.1 delay, 30% of 0.1 - 1.0 delay, 10% of 5 seconds delay),
    /// and will randomly return errors for 5% of requests.
    #[structopt(long)]
    sloppy: bool,
}

fn load_tokens(path: impl AsRef<Path>) -> Result<Vec<TokenInfo>, serde_json::Error> {
    let mut full_path = parse_env::<PathBuf>("ZKSYNC_HOME");
    full_path.push(path);
    serde_json::from_str(&read_to_string(full_path).unwrap())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let _vlog_guard = vlog::init();
    let network = ChainConfig::from_env().eth.network;

    let opts = FeeTickerOpts::from_args();
    if opts.sloppy {
        vlog::info!("Fee ticker server will run in a sloppy mode.");
    }

    let shared_data = web::Data::new(ProxyState {
        cache: std::sync::Arc::new(Mutex::new(HashMap::new())),
    });

    HttpServer::new(move || {
        let base_app = App::new()
            .wrap(Cors::default().send_wildcard().max_age(3600))
            .wrap(middleware::Logger::default());
        match network {
            Network::Testnet => base_app
                .app_data(shared_data.clone())
                .service(proxy_price_provider::create_price_service())
                .service(proxy_liquidity_provider::config_liquidity_app()),
            Network::Mainnet => {
                panic!("{}", "Not meant to be running against mainnet!".to_string())
            }
            _ => base_app
                .configure(dev_liquidity_provider::config_liquidity_app)
                .service(dev_price_provider::create_price_service(opts.sloppy)),
        }
    })
    .bind("0.0.0.0:9876")
    .unwrap()
    .shutdown_timeout(1)
    .run()
    .await
}
