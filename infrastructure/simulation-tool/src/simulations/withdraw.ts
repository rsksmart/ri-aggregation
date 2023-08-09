import { PreparedWithdrawal, executeWithdrawals, generateWithdrawals, resolveWithdrawTransactions } from '../operations/withdraw';
import { SimulationConfiguration } from './setup';
import config from '../utils/config.utils';
import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { generateWallets } from '../utils/wallet.utils';
import { ensureL1Funds, ensureRollupFunds } from '../operations/common';
import { BigNumber } from 'ethers';

const runSimulation = async ({ txCount, txDelay, walletGenerator, funderL2Wallet }: SimulationConfiguration) => {
    const { numberOfAccounts } = config;
    console.log('Creating deposit users from HD wallet ...');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);

    console.log(`Creating ${txCount} withdrawals ...`);
    const preparedWithdrawals: PreparedWithdrawal[] = await generateWithdrawals(txCount, users);
    console.log(`Created ${preparedWithdrawals.length} withdrawals`);

    console.log(`Ensure L1 funds for ${users.length} users ...`);
    const ensureAccountFunds = ensureL1Funds(funderL2Wallet._ethSigner);
    for (const {from, amount} of preparedWithdrawals) {
        await ensureAccountFunds(BigNumber.from(amount), from._ethSigner);
    }

    console.log(`Ensure L2 funds for ${users.length} users ...`);
    for (const {from, amount} of preparedWithdrawals) {
        await ensureRollupFunds(BigNumber.from(amount), from);
    }

    const executedTx: Transaction[] = await Promise.all(
        (await executeWithdrawals(preparedWithdrawals, txDelay)).map((tx) => tx)
    );

    console.log(`Executed ${executedTx.length} withdrawals`)

    await resolveWithdrawTransactions(executedTx);
};

export { runSimulation as runWithdrawSimulation };
