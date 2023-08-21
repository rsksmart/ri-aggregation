import { Command } from "commander";
import * as utils from "../utils";

export async function generateWallet(
  network: string,
  l1Address: string,
  l1PrivateKey: string
) {
  await utils.spawn(
    `cargo run --bin rif_aggregation_wallet_creator --release -- ${network} ${l1Address} ${l1PrivateKey}`
  );
}

export const command = new Command("generate-wallet")
  .description("generate L2 private key")
  .arguments("<network> [l1Address] [l1PrivateKey]")
  .action(
    async (
      network: string,
      l1Address: string = "",
      l1PrivateKey: string = ""
    ) => {
      if (l1Address !== "" && l1PrivateKey === "") {
        console.log("Must provide an L1 private key if L1 address is present");
        return;
      }

      await generateWallet(network, l1Address, l1PrivateKey);
    }
  );
