import { Transaction, Wallet } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import {
    PreparedTransfer,
    executeTransfers,
    generateTransfers,
    generateTransfersToNew,
    resolveTransactions
} from '../operations/transfer';
import { generateWallets } from '../utils/wallet.utils';
import { SimulationConfiguration } from './setup';
import config from '../utils/config.utils';
import { ensureRollupFunds } from '../operations/common';

const runSimulation = async ({ walletGenerator, txCount, txDelay, funderL2Wallet }: SimulationConfiguration) => {
    const { numberOfAccounts } = config;
    // Create users
    console.log('Creating transfer users from HD wallet ...');
    let users: Wallet[] = [];
    let done = false;

    while (users.length < numberOfAccounts - 1 && !done) {
        const { value: account, ...result } = await walletGenerator.next();
        done = result.done;

        const isActive = await account.isSigningKeySet();
        if (!isActive) {
            users.push(account);
        }
    }
    await generateWallets(numberOfAccounts - 1, walletGenerator);

    console.log(`Created ${users.length} users.`);

    // Create transactions
    console.log(`Creating ${txCount} transfers ...`);

    const preparedTransfers: PreparedTransfer[] = generateTransfersToNew(txCount, [funderL2Wallet, ...users]);
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions
    const totalTransferAmount = preparedTransfers.reduce((accumulator: BigNumber, { amount }: PreparedTransfer) => {
        accumulator.add(amount);

        return accumulator;
    }, constants.Zero);

    await ensureRollupFunds(totalTransferAmount, funderL2Wallet);

    // Execute transactions
    const executedTx: Transaction[] = await Promise.all(
        (await executeTransfers(preparedTransfers, txDelay)).map((tx) => tx)
    );

    // List execution results
    await resolveTransactions(executedTx);
};

export { runSimulation as runTransferToNewSimulation };
