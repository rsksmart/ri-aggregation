# RIF Aggregation wallet creators

The purpose of this is command to add a new wallet to the L2. You can use it in two ways.

1. Create a new random wallet
2. Use a wallet from L1 and the private key assigned to it

Navigate to `ri-aggregation/core/lib/wallet_creator`, build with `cargo build` and then run it with `cargo run rif_aggreation_wallet_creator` to create a random one.

run `cargo run rif_aggreation_wallet_creator <eth_address> <private_key>` to add a L1 to L2.