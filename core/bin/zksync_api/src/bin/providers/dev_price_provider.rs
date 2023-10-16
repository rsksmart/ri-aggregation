//! Ticker implementation for dev environment
//!
//! Implements coinmarketcap API for tokens deployed using `deploy-dev-erc20`
//! Prices are randomly distributed around base values estimated from real world prices.

use actix_web::{web, HttpRequest, HttpResponse, Result};
use bigdecimal::BigDecimal;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, fs::read_to_string, path::Path};
use std::{convert::TryFrom, time::Duration};
use zksync_crypto::rand::{thread_rng, Rng};
use zksync_types::Address;

use super::proxy_utils::API_PATH;

#[derive(Debug, Serialize, Deserialize)]
struct CoinMarketCapTokenQuery {
    symbol: String,
}

macro_rules! make_sloppy {
    ($f: ident) => {{
        |query, data| async {
            if thread_rng().gen_range(0, 100) < 5 {
                vlog::debug!("`{}` has been errored", stringify!($f));
                return Ok(HttpResponse::InternalServerError().finish());
            }

            let duration = match thread_rng().gen_range(0, 100) {
                0..=59 => Duration::from_millis(100),
                60..=69 => Duration::from_secs(5),
                _ => {
                    let ms = thread_rng().gen_range(100, 1000);
                    Duration::from_millis(ms)
                }
            };

            vlog::debug!(
                "`{}` has been delayed for {}ms",
                stringify!($f),
                duration.as_millis()
            );
            tokio::time::sleep(duration).await;

            let resp = $f(query, data).await;
            resp
        }
    }};
}

#[derive(Debug, Deserialize)]
struct Token {
    pub address: Address,
    // While never used directly, it is better to keep this field here so that it is easy to know what fields are
    // available for the test tokens.
    #[allow(dead_code)]
    pub decimals: u8,
    pub symbol: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct TokenData {
    id: String,
    symbol: String,
    name: String,
    platforms: HashMap<String, Address>,
}

fn load_tokens(path: impl AsRef<Path>) -> Vec<TokenData> {
    if let Ok(text) = read_to_string(path) {
        let tokens: Vec<Token> = serde_json::from_str(&text).unwrap();
        let tokens_data: Vec<TokenData> = tokens
            .into_iter()
            .map(|token| {
                let symbol = token.symbol.to_lowercase();
                let mut platforms = HashMap::new();
                platforms.insert(String::from("rootstock"), token.address);
                let id = match symbol.as_str() {
                    "rbtc" => String::from("rootstock"),
                    "wBTC" => String::from("wrapped-bitcoin"),
                    "bat" => String::from("basic-attention-token"),
                    "RIF" => String::from("RSK-infrastructure-framework"),
                    _ => symbol.clone(),
                };

                TokenData {
                    id,
                    symbol: symbol.clone(),
                    name: symbol,
                    platforms,
                }
            })
            .collect();
        tokens_data
    } else {
        Vec::new()
    }
}

async fn handle_coingecko_token_list(
    _req: HttpRequest,
    data: web::Data<Vec<TokenData>>,
) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json((*data.into_inner()).clone()))
}

async fn handle_coingecko_token_price_query(
    req: HttpRequest,
    _data: web::Data<Vec<TokenData>>,
) -> Result<HttpResponse> {
    let coin_id = req.match_info().get("coin_id");
    let base_price = match coin_id {
        Some("rootstock") => BigDecimal::from(200),
        Some("wrapped-bitcoin") => BigDecimal::from(9000),
        Some("basic-attention-token") => BigDecimal::try_from(0.2).unwrap(),
        Some("RSK-smart-bitcoin") => BigDecimal::from(18000),
        Some("RSK-infrastructure-framework") => BigDecimal::try_from(0.04).unwrap(),
        _ => BigDecimal::from(1),
    };
    let random_multiplier = thread_rng().gen_range(0.9, 1.1);
    let price = base_price * BigDecimal::try_from(random_multiplier).unwrap();

    let last_updated = Utc::now().timestamp_millis();
    let resp = json!({
        "prices": [
            [last_updated, price],
        ]
    });
    vlog::info!("1.0 {:?} = {} USD", coin_id, price);
    Ok(HttpResponse::Ok().json(resp))
}

pub fn create_price_service(sloppy_mode: bool) -> actix_web::Scope {
    let localhost_tokens = load_tokens("etc/tokens/localhost.json");
    let testnet_tokens = load_tokens("etc/tokens/testnet.json");
    let data: Vec<TokenData> = localhost_tokens
        .into_iter()
        .chain(testnet_tokens.into_iter())
        .collect();
    if sloppy_mode {
        web::scope(API_PATH)
            .app_data(web::Data::new(data))
            .route(
                "/coins/list",
                web::get().to(make_sloppy!(handle_coingecko_token_list)),
            )
            .route(
                "/coins/{coin_id}/market_chart",
                web::get().to(make_sloppy!(handle_coingecko_token_price_query)),
            )
    } else {
        web::scope(API_PATH)
            .app_data(web::Data::new(data))
            .route("/coins/list", web::get().to(handle_coingecko_token_list))
            .route(
                "/coins/{coin_id}/market_chart",
                web::get().to(handle_coingecko_token_price_query),
            )
    }
}
