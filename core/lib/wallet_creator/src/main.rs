use std::{env};

use rif_aggreation_wallet_creator_lib::{
    create_new_wallet
};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args: Vec<String> = env::args().collect();

    let network: &str = &args[2];
    let mut address: &str = "";
    let mut key: &str = "";

    if args.len() > 4 {       
        address = &args[3];
        key = &args[4];

        println!("Address and key supplied will be used");
    } else {
        println!("No address and key supplied. Random will be generated");
    }
    
    let _wallet = create_new_wallet(network, address, key).await?;
    println!("-> Wallet created");

    Ok(())
}
