import { Command } from "commander";
import * as utils from "../utils";

export async function generateRandomWallet(network: string) {
  await utils.spawn(
    `cargo run --bin rif_aggregation_wallet_creator --release -- ${network}`
  );
}

export const command = new Command("generate-wallet")
  .description("generate L2 private key")
  .arguments("[network]")
  .action(async (network: string) => {
    await generateRandomWallet(network);
  });
