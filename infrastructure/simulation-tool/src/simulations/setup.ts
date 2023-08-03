import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { Signer } from 'ethers';
import config from '../utils/config.utils';
import { RollupWalletGenerator, activateL2Account, createWalletGenerator } from '../utils/wallet.utils';
import { CHAIN_TO_NETWORK } from '../constants/network';
import { prepareDevL1Account } from '../utils/dev.utils';
import { depositToSelf } from '../operations/deposit';

type SimulationConfiguration = {
    walletGenerator: RollupWalletGenerator;
    funderL2Wallet: RollupWallet;
    txDelay: number;
    txCount: number;
};

const SECOND_IN_MS = 1000;

const fundFunderInDev = async (funderL1Wallet: Signer) => {
    const balance = await funderL1Wallet.getBalance();
    const network = await funderL1Wallet.provider.getNetwork();
    if (balance.isZero() && CHAIN_TO_NETWORK[network.chainId] === 'regtest') {
        console.log('HD wallet on regtest has no balance');

        return prepareDevL1Account(funderL1Wallet);
    }
};

const setupSimulation = async (): Promise<SimulationConfiguration> => {
    // Read configuration
    console.log('Using configuration:', config);
    const { transactionsPerSecond, totalRunningTimeSeconds } = config;

    // Read environment variables
    const mnemonic =
        process.env.MNEMONIC ||
        'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';
    const l1WalletGenerator = createWalletGenerator(mnemonic);
    const funderWallet: RollupWallet = (await l1WalletGenerator.next()).value;

    // Fund Funder on for development if need be
    await fundFunderInDev(funderWallet._ethSigner);

    const funderL2Balance = await funderWallet.getBalance('RBTC');
    // Deposit to Funder L2 wallet
    if (funderL2Balance.isZero()) {
        const funderl1Balance = await funderWallet._ethSigner.getBalance();
        console.log('Funder L2 wallet has no balance. Depositing from L1.');
        await depositToSelf(funderWallet, funderl1Balance.div(2));
    }

    // Activate funder on L2 if need be
    if (!(await funderWallet.isSigningKeySet())) {
        console.log('L2 wallet is not activated.');
        await activateL2Account(funderWallet);
    }

    const txCount = Math.floor(totalRunningTimeSeconds * transactionsPerSecond);
    const txDelay = SECOND_IN_MS / transactionsPerSecond;

    return {
        walletGenerator: l1WalletGenerator,
        funderL2Wallet: funderWallet,
        txCount,
        txDelay
    };
};

export type { SimulationConfiguration };

export { setupSimulation, SECOND_IN_MS };
