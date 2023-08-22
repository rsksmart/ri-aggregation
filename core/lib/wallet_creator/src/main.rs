use std::env;

use rif_rollup_wallet_generator_lib::create_new_wallet;

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let args: Vec<String> = env::args().collect();

    println!("{:?}", args);

    let network: &str = &args[1];
    let mut address: &str = "";
    let mut key: &str = "";

    if args.len() > 3 {
        address = &args[2];
        key = &args[3];

        println!("Address and key supplied will be used");
    } else {
        println!("No address and key supplied. Random will be generated");
    }

    let _wallet = create_new_wallet(network, address, key).await?;
    println!("-> Wallet created");

    Ok(())
}
