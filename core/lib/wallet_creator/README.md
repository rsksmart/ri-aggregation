# RIF Rollup Wallet Generator

**Important** For localhost, you need to have a node of rsk and the zk server running.

The purpose of this command is to add a new wallet to the L2. You can use it in two ways.

1. Create a new random wallet
2. Use a wallet from L1 and the private key assigned to it

## Run

To run the tool run directly the Rust binary:

```
cargo run --bin rif_rollup_wallet_generator <network> <eth_address> <private_key>` to add a L1 to L2.
```

Or run it through the infrastructure command:

```
zk run generate-wallet <network> [l1-address] [l1-key]
```

## Note

- The wallet address and private key will be printed on console.
- The networks supported are `localhost`, `mainnet` (RSK Mainnet) and `testnet` (RSK Testnet).

## Tests

The tests are included in the `zk test i all` suite, to run indvidually:

For unit tests, run the command:

```
zk test wallet-generator
```

For integration tests, run the command:

```
zk test i wallet-generator
```

Or to do it manually:

Navigate to `ri-aggregation/core/lib/wallet_creator` and run:

Unit tests

```
cargo test
```

Integration tests

```
cargo test -- --ignored
```
