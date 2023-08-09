import nodeConfig from "config";
import { BigNumberish } from "ethers";

type TxValueLimits = [BigNumberish, BigNumberish];

type Config = {
  rollupUrl: string;
  nodeUrl: string;
  chainId: number;
  transactionsPerSecond: number;
  totalRunningTimeSeconds: number;
  numberOfAccounts: number;
  weiLimits: {
    deposit: TxValueLimits;
    transferToNew: TxValueLimits;
    transfer: TxValueLimits;
    withdraw: TxValueLimits;
  };
};

const getConfig = (key: keyof Config): Config[typeof key] =>
  nodeConfig.get<Config[typeof key]>(key);

const config: Record<keyof Config, ReturnType<typeof getConfig>> = {
  rollupUrl: getConfig("rollupUrl"),
  nodeUrl: getConfig("nodeUrl"),
  chainId: getConfig("chainId"),
  transactionsPerSecond: getConfig("transactionsPerSecond"),
  totalRunningTimeSeconds: getConfig("totalRunningTimeSeconds"),
  numberOfAccounts: getConfig("numberOfAccounts"),
  weiLimits: getConfig("weiLimits"),
};

export default config as Config;
export type { Config, TxValueLimits };
