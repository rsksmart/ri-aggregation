import { Transaction, Wallet } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { ensureRollupFunds } from '../operations/common';
import {
    PreparedTransfer,
    executeTransfers,
    generateTransfersToNew,
    resolveTransactions
} from '../operations/transfer';
import config from '../utils/config.utils';
import { SimulationConfiguration } from './setup';

const runSimulation = async ({ walletGenerator, txCount, txDelay, funderL2Wallet }: SimulationConfiguration) => {
    console.time('total time');
    const { numberOfAccounts } = config;
    // Create users
    console.log('Creating transfer users from HD wallet ...');
    console.time('users');
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
    console.timeEnd('users');
    console.log(`Created ${users.length} users.`);

    // Create transactions
    console.log(`Creating ${txCount} transfers ...`);
    console.time('tx preparation');
    const preparedTransfers: PreparedTransfer[] = generateTransfersToNew(txCount, [funderL2Wallet, ...users]);
    console.timeEnd('tx preparation');
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions
    console.time('collect amounts');
    const totalTransferAmount = preparedTransfers.reduce((accumulator: BigNumber, { amount }: PreparedTransfer) => {
        accumulator.add(amount);

        return accumulator;
    }, constants.Zero);
    console.timeEnd('collect amounts');
    console.time('funding');
    await ensureRollupFunds(totalTransferAmount, funderL2Wallet);
    console.timeEnd('funding');

    // Execute transactions
    console.time('execution');
    const executedTx: Transaction[] = await Promise.all(
        (await executeTransfers(preparedTransfers, txDelay)).map((tx) => tx)
    );
    console.timeEnd('execution');

    // List execution results
    console.time('resolution');
    await resolveTransactions(executedTx);
    console.timeEnd('resolution');
    console.timeEnd('total time');
};

export { runSimulation as runTransferToNewSimulation };
