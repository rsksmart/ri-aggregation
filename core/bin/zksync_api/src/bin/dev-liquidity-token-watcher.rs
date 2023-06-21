//! Token watcher implementation for dev environment
//!
//! Implements Coingecko API for token which are deployed in localhost network
//!
use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::BufReader,
    path::Path,
};

use actix_cors::Cors;
use actix_web::{dev::AnyBody, middleware, web, App, HttpResponse, HttpServer, Result};
use bigdecimal::{BigDecimal, ToPrimitive};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use zksync_api::fee_ticker::CoinGeckoTypes::{AssetPlatform, ContractSimplified};

use zksync_config::{
    configs::dev_liquidity_token_watcher::Regime, DevLiquidityTokenWatcherConfig, ETHClientConfig,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
struct TokenData {
    address: String,
    name: String,
    volume: BigDecimal,
}

type Tokens = HashMap<String, TokenData>;

#[derive(Debug, Clone)]
enum VolumeStorage {
    Blacklist(HashSet<String>, BigDecimal),
    Whitelist(Tokens),
}

impl VolumeStorage {
    fn whitelisted_tokens(tokens: Vec<(String, String)>, default_volume: BigDecimal) -> Self {
        let whitelist_tokens: Tokens = tokens
            .into_iter()
            .map(|(address, name)| {
                (
                    address.clone(),
                    TokenData {
                        address,
                        name,
                        volume: default_volume.clone(),
                    },
                )
            })
            .collect();
        Self::Whitelist(whitelist_tokens)
    }

    fn blacklisted_tokens(tokens: HashSet<String>, default_volume: BigDecimal) -> Self {
        Self::Blacklist(tokens, default_volume)
    }

    fn get_volume(&self, address: &str) -> BigDecimal {
        match self {
            Self::Blacklist(tokens, default_volume) => {
                if tokens.get(address).is_some() {
                    BigDecimal::from(0)
                } else {
                    default_volume.clone()
                }
            }

            Self::Whitelist(tokens) => {
                let volume = if let Some(token) = tokens.get(address) {
                    token.volume.clone()
                } else {
                    BigDecimal::from(0)
                };

                volume
            }
        }
    }
}

type PlatformId = String;
type CoinGeckoStorage = HashMap<PlatformId, VolumeStorage>;

const DEV_PLATFORM_ID: &str = "regtest";
const DEV_PLATFORM_NAME: &str = "Local Dev Regtest";
const DEV_PLATFORM_SHORTNAME: &str = "localdev";

fn load_tokens(path: impl AsRef<Path>) -> Vec<(String, String)> {
    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);

    let values: Vec<HashMap<String, Value>> = serde_json::from_reader(reader).unwrap();
    let tokens: Vec<(String, String)> = values
        .into_iter()
        .map(|value| {
            let address = value["address"].as_str().unwrap().to_ascii_lowercase();
            (address, value["name"].to_string())
        })
        .collect();
    tokens
}

async fn handle_get_asset_platforms() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(vec![AssetPlatform {
        id: String::from(DEV_PLATFORM_ID),
        chain_identifier: Some(ETHClientConfig::from_env().chain_id as i64),
        name: String::from(DEV_PLATFORM_NAME),
        shortname: String::from(DEV_PLATFORM_SHORTNAME),
    }]))
}

async fn handle_get_coin_contract(
    path: web::Path<(String, String)>,
    storage: web::Data<CoinGeckoStorage>,
) -> Result<HttpResponse> {
    let (platform_id, contract_address) = path.into_inner();
    if let Some(volume_storage) = storage.get(&platform_id) {
        let volume = volume_storage.get_volume(&contract_address);
        let mut contract = ContractSimplified::default();
        contract.market_data.total_volume.usd = volume.to_f64();

        return Ok(HttpResponse::Ok().json(contract));
    }

    HttpResponse::BadRequest().message_body(AnyBody::from_message(format!(
        "Invalid platform_id {}.",
        &platform_id
    )))
}

pub fn config_app(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/asset_platforms").route(web::get().to(handle_get_asset_platforms)))
        .service(
            web::scope("/coins").service(
                web::scope("/{platform_id}").service(
                    web::scope("/contract").service(
                        web::resource("/{contract_address}")
                            .route(web::get().to(handle_get_coin_contract)),
                    ),
                ),
            ),
        );
}

fn main() {
    vlog::init();

    let runtime = actix_rt::System::new();
    let config = DevLiquidityTokenWatcherConfig::from_env();

    let volume_storage = match config.regime {
        Regime::Blacklist => VolumeStorage::blacklisted_tokens(
            config.blacklisted_tokens,
            config.default_volume.into(),
        ),
        Regime::Whitelist => {
            let whitelisted_tokens = load_tokens("etc/tokens/localhost.json");
            VolumeStorage::whitelisted_tokens(whitelisted_tokens, config.default_volume.into())
        }
    };

    let eth_client_config = ETHClientConfig::from_env();
    let chain_id = eth_client_config.chain_id.to_string();
    let storage: CoinGeckoStorage = [(chain_id, volume_storage)].iter().cloned().collect();

    runtime.block_on(async {
        HttpServer::new(move || {
            App::new()
                .app_data(web::Data::new(storage.clone()))
                .wrap(Cors::default().send_wildcard().max_age(3600))
                .wrap(middleware::Logger::default())
                .configure(config_app)
        })
        .bind("0.0.0.0:9975")
        .unwrap()
        .shutdown_timeout(1)
        .run()
        .await
        .expect("Server crashed");
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn get_volume_for_whitelisted() {
        let token = ("addr".to_string(), "name".to_string());
        let storage = VolumeStorage::whitelisted_tokens(vec![token.clone()], 500.into());

        let volume = storage.get_volume(&token.0);
        assert_eq!(volume, 500.into());
        let volume = storage.get_volume("wrong_addr");
        assert_eq!(volume, 0.into())
    }
    #[test]
    fn get_volume_for_blacklisted() {
        let token = "addr".to_string();
        let mut tokens = HashSet::new();
        tokens.insert(token.clone());
        let storage = VolumeStorage::blacklisted_tokens(tokens, 500.into());

        let volume = storage.get_volume(&token);
        assert_eq!(volume, 0.into());
        let volume = storage.get_volume("another_token");
        assert_eq!(volume, 500.into())
    }
}

#[cfg(test)]
mod handlers_tests {
    use super::*;
    use actix_web::{
        body::{to_bytes, BoxAnyBody},
        dev::AnyBody,
        web,
    };
    use bigdecimal::FromPrimitive;

    #[actix_web::test]
    async fn get_asset_list() {
        let expected_platform: AssetPlatform = AssetPlatform {
            id: String::from(DEV_PLATFORM_ID),
            chain_identifier: Some(ETHClientConfig::from_env().chain_id as i64),
            name: String::from(DEV_PLATFORM_NAME),
            shortname: String::from(DEV_PLATFORM_SHORTNAME),
        };

        let response = handle_get_asset_platforms().await.unwrap();
        let status = response.status();

        assert!(status.is_success());
        let body = serde_json::from_slice::<Vec<AssetPlatform>>(
            &to_bytes(AnyBody::Message(BoxAnyBody::from_body(
                response.into_body(),
            )))
            .await
            .unwrap()
            .to_vec(),
        )
        .unwrap(); // is this really the simplest way to get the body? seems so unnecessary to convert it to BoxAnyBody, etc!

        let platform_option = body
            .iter()
            .find(|actual_platform| actual_platform.id.eq(&expected_platform.id));

        assert!(platform_option.is_some());

        let actual_platform = platform_option.unwrap();

        assert_eq!(
            actual_platform.chain_identifier,
            expected_platform.chain_identifier
        );
        assert_eq!(actual_platform.name, expected_platform.name);
        assert_eq!(actual_platform.shortname, expected_platform.shortname);
    }

    #[actix_web::test]
    async fn get_coin_contract() {
        let expected_volume = BigDecimal::from_f32(2.34567).unwrap();
        let token_address = format!("0x2acc95758f8b5f583470ba265eb685a8f45fc9d5");
        let expected_token = (token_address.clone(), format!("Token Name"));
        let tokens = vec![expected_token];
        let platform_id = format!("localhost");
        let path = web::Path::from((platform_id.clone(), token_address));

        let volume_storage = VolumeStorage::whitelisted_tokens(tokens, expected_volume.clone());

        let storage: CoinGeckoStorage = [(platform_id, volume_storage)].iter().cloned().collect();
        let storage_data: web::Data<CoinGeckoStorage> = web::Data::new(storage);

        let response = handle_get_coin_contract(path, storage_data).await.unwrap();
        let status = response.status();
        assert!(status.is_success());

        let parsed_body: ContractSimplified = serde_json::from_slice(
            &to_bytes(AnyBody::Message(BoxAnyBody::from_body(
                response.into_body(),
            )))
            .await
            .unwrap()
            .to_vec(),
        )
        .unwrap(); // is this really the simplest way to get the body? seems so unnecessary to convert it to BoxAnyBody, etc!

        assert!(parsed_body.market_data.total_volume.usd.is_some());
        let volume = parsed_body.market_data.total_volume.usd.unwrap(); // For now we're only interested in this field
        assert_eq!(volume, expected_volume.to_f64().unwrap());
    }
}
