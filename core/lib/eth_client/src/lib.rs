pub mod clients;
pub mod ethereum_gateway;
pub use clients::http_client::ETHDirectClient;
pub use clients::multiplexer::MultiplexerRootstockClient;
pub use ethereum_gateway::{RootstockGateway, SignedCallResult};
