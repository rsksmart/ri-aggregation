import { RestProvider, SyncProvider as RollupProvider, Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { Wallet as EthersWallet, constants } from 'ethers';
import config from '../utils/config.utils';
import { L1WalletGenerator, activateL2Account, createWalletGenerator } from '../utils/wallet.utils';
import { CHAIN_TO_NETWORK } from '../constants/network';
import { prepareDevL1Account } from '../utils/dev.utils';
import { depositToSelf } from '../operations/deposit';

type SimulationConfiguration = {
    l1WalletGenerator: L1WalletGenerator;
    rollupProvider: RollupProvider;
    funderL2Wallet: RollupWallet;
    txDelay: number;
    txCount: number;
};

const SECOND_IN_MS = 1000;

const fundFunderInDev = async (funderL1Wallet: EthersWallet) => {
    const balance = await funderL1Wallet.getBalance();
    const network = await funderL1Wallet.provider.getNetwork();
    if (balance.isZero() && CHAIN_TO_NETWORK[network.chainId] === 'regtest') {
        console.log('HD wallet on regtest has no balance');

        return prepareDevL1Account(funderL1Wallet as EthersWallet);
    }
};

const setupSimulation = async (): Promise<SimulationConfiguration> => {
    // Read configuration
    console.log('Using configuration:', config);
    const { rollupUrl, transactionsPerSecond, totalRunningTimeSeconds } = config;

    // Read environment variables
    const mnemonic =
        process.env.MNEMONIC ||
        'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';
    const l1WalletGenerator = createWalletGenerator(mnemonic);
    const funderL1Wallet = l1WalletGenerator.next().value;
    const rollupProvider = await RestProvider.newProvider(rollupUrl + '/api/v0.2');
    const funderL2Wallet = await RollupWallet.fromEthSigner(funderL1Wallet, rollupProvider);

    // Fund Funder on for development if need be
    await fundFunderInDev(funderL1Wallet);

    const funderL2Balance = await funderL2Wallet.getBalance(constants.AddressZero);
    // Deposit to Funder L2 wallet
    if (funderL2Balance.isZero()) {
        const funderl1Balance = await funderL1Wallet.getBalance();
        await depositToSelf(funderL2Wallet, funderl1Balance.div(2));
    }

    // Activate funder on L2 if need be
    if (!(await funderL2Wallet.isSigningKeySet())) {
        console.log('L2 wallet is not activated.');
        await activateL2Account(funderL2Wallet);
    }

    const txCount = Math.floor(totalRunningTimeSeconds * transactionsPerSecond);
    const txDelay = SECOND_IN_MS / transactionsPerSecond;

    return {
        rollupProvider,
        l1WalletGenerator,
        funderL2Wallet,
        txCount,
        txDelay,
        ...config
    };
};

export type { SimulationConfiguration };

export { setupSimulation, SECOND_IN_MS };
