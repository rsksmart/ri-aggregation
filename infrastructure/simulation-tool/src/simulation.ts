import {
    RestProvider,
    SyncProvider as RollupProvider,
    Transaction,
    Wallet as RollupWallet
} from '@rsksmart/rif-rollup-js-sdk';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber, Wallet as EthersWallet } from 'ethers';
import config, { Config } from './config';
import { prepareDevL1Account } from './devUtils';
import { executeDeposit, getDepositResult, prepareDeposit } from './operations/deposit';
import { PreparedTransfer, executeTransfers, generateTransfers, prepareTransfer } from './operations/transfer';
import {
    L1WalletGenerator,
    activateL2Account,
    generateL1Wallets,
    createRollupWallet,
    createWalletGenerator
} from './wallet';
import { depositToSelf } from './simulations/deposit';
import { RandomAmountGenerator, createRandomAmountGenerator } from './numberUtils';
import { CHAIN_TO_NETWORK } from './constants';
import { chooseRandomWallet } from './operations/utils';

const SECOND_IN_MS = 1000;

type Limits = `${keyof Config['weiLimits']}Generator`;
type SimulationConfiguration = {
    [key in Limits]: RandomAmountGenerator;
} & {
    l1WalletGenerator: L1WalletGenerator;
    rollupProvider: RollupProvider;
} & Config;

const setupSimulation = async (): Promise<SimulationConfiguration> => {
    // Read configuration
    console.log('Using configuration:', config);
    const { rollupUrl } = config;

    // Read environment variables
    const mnemonic =
        process.env.MNEMONIC ||
        'coyote absorb fortune village riot razor bright finish number once churn junior various slice spatial';

    // Create generators
    return {
        rollupProvider: await RestProvider.newProvider(rollupUrl + '/api/v0.2'),
        l1WalletGenerator: createWalletGenerator(mnemonic),
        depositGenerator: createRandomAmountGenerator(config.weiLimits.deposit),
        transferToNewGenerator: createRandomAmountGenerator(config.weiLimits.transferToNew),
        ...config
    };
};

const fundFunderInDev = async (funderL1Wallet: EthersWallet) => {
    const balance = await funderL1Wallet.getBalance();
    const network = await funderL1Wallet.provider.getNetwork();
    if (balance.isZero() && CHAIN_TO_NETWORK[network.chainId] === 'regtest') {
        console.log('HD wallet on regtest has no balance');

        return prepareDevL1Account(funderL1Wallet as EthersWallet);
    }
};

const run = async () => {
    const { l1WalletGenerator, rollupProvider, numberOfAccounts, totalRunningTimeSeconds, transactionsPerSecond } =
        await setupSimulation();
    const funderL1Wallet = l1WalletGenerator.next().value;
    const funderL2Wallet = await RollupWallet.fromEthSigner(funderL1Wallet, rollupProvider);

    console.log(`HD account -> L1: ${await funderL1Wallet.getAddress()}, L2: ${await funderL2Wallet.getAccountId()}.`);

    // Fund Funder on for development if need be
    await fundFunderInDev(funderL1Wallet);

    // Activate funder on L2 if need be
    if (!(await funderL2Wallet.isSigningKeySet())) {
        console.log('L2 wallet is not acivated.');
        await activateL2Account(funderL2Wallet);
    }

    // Deposit to Funder wallet
    await depositToSelf(funderL1Wallet, funderL2Wallet);

    // Create recepients
    console.log('Creating transfer recepients from HD wallet ...');
    const recepients = generateL1Wallets(numberOfAccounts - 1, l1WalletGenerator); // - 1 as the Funder wallet is first to be derived (TODO: ? perhaps change to numberOfAccounts to be already without Funder ?)
    console.log(`Created ${recepients.length} recipients.`);

    // Create transactions
    console.log('Creating transfers ...');
    const txCount = totalRunningTimeSeconds * transactionsPerSecond;

    const preparedTransfers: PreparedTransfer[] = generateTransfers(txCount, funderL2Wallet, recepients);
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions

    // Execute transactions
    console.log('Executing transfers ...');
    const delay = SECOND_IN_MS / transactionsPerSecond;

    const executedTx: Promise<Transaction>[] = await executeTransfers(preparedTransfers, funderL2Wallet, delay);

    // List execution results
    console.log('Resolving transactions ...');
    for (const txPromise of executedTx) {
        const tx = await txPromise;
        const receipt = await tx.awaitReceipt();
        const verification = await tx.awaitVerifyReceipt();
        console.log(
            `Transaction #${tx.txHash} ${receipt.success ? 'added' : 'failed with: ' + receipt.failReason} in block #${
                receipt.block.blockNumber
            }.`
        );
        console.log(
            `Verification of block #${verification.block.blockNumber} ${
                verification.success ? 'successfull' : 'failed with: ' + verification.failReason
            }.`
        );
    }
};

export { run };
