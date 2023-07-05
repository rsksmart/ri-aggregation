use actix_cors::Cors;
use actix_web::{middleware, App, HttpServer};
use providers::{
    dev_liquidity_provider::config_liquidity_app, dev_price_provider::create_price_service,
};
use structopt::StructOpt;

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

    let opts = FeeTickerOpts::from_args();
    if opts.sloppy {
        vlog::info!("Fee ticker server will run in a sloppy mode.");
    }

    HttpServer::new(move || {
        App::new()
            .wrap(Cors::default().send_wildcard().max_age(3600))
            .wrap(middleware::Logger::default())
            .configure(config_liquidity_app)
            .service(create_price_service(opts.sloppy))
    })
    .bind("0.0.0.0:9876")
    .unwrap()
    .shutdown_timeout(1)
    .run()
    .await
}
