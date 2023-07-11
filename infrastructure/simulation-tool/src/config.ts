import nodeConfig from 'config';
import { BigNumberish } from 'ethers';

type TxValueLimits = [BigNumberish, BigNumberish];

type Config = {
    rollupUrl: string;
    nodeUrl: string;
    transactionsPerSecond: number;
    totalTransactions: number;
    numberOfAccounts: number;
    weiLimits: {
        deposit: TxValueLimits;
        transferToNew: TxValueLimits;
    };
};

const getConfig = (key: keyof Config): Config[typeof key] => nodeConfig.get<Config[typeof key]>(key);

const config: Record<keyof Config, ReturnType<typeof getConfig>> = {
    rollupUrl: getConfig('rollupUrl'),
    nodeUrl: getConfig('nodeUrl'),
    transactionsPerSecond: getConfig('transactionsPerSecond'),
    totalTransactions: getConfig('totalTransactions'),
    numberOfAccounts: getConfig('numberOfAccounts'),
    weiLimits: getConfig('weiLimits')
};

export default config as Config;
export type { Config, TxValueLimits };
