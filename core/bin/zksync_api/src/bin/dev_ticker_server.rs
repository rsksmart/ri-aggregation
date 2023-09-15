use actix_cors::Cors;
use actix_web::{middleware, App, HttpServer};
use providers::{
    dev_liquidity_provider, dev_price_provider, proxy_liquidity_provider, proxy_price_provider,
};
use structopt::StructOpt;
use zksync_config::ZkSyncConfig;
use zksync_types::network::Network;

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

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let _vlog_guard = vlog::init();
    let network = ZkSyncConfig::from_env().chain.eth.network;

    let opts = FeeTickerOpts::from_args();
    if opts.sloppy {
        vlog::info!("Fee ticker server will run in a sloppy mode.");
    }

    HttpServer::new(move || {
        let base_app = App::new()
            .wrap(Cors::default().send_wildcard().max_age(3600))
            .wrap(middleware::Logger::default());
        match network {
            Network::Testnet => base_app
                .configure(proxy_liquidity_provider::config_liquidity_app)
                .service(proxy_price_provider::create_price_service()),
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
