import {
  Wallet as RollupWallet,
  RootstockOperation,
  utils,
} from "@rsksmart/rif-rollup-js-sdk";
import { expect, use } from "chai";
import { BigNumber, ContractReceipt, Wallet as EthersWallet } from "ethers";
import sinon from "sinon";
import sinonChai from "sinon-chai";
