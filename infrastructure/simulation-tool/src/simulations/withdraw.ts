import {
    PreparedWithdrawal,
    executeWithdrawals,
    generateWithdrawals,
    resolveWithdrawTransactions
} from '../operations/withdraw';
import { SimulationConfiguration } from './setup';
import config from '../utils/config.utils';
import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { generateWallets } from '../utils/wallet.utils';
import { ensureL2AccountActivation, ensureRollupFunds, ensureRollupFundsFromRollup } from '../operations/common';
import { BigNumber, ethers } from 'ethers';

const runSimulation = async ({ txCount, txDelay, walletGenerator, funderL2Wallet }: SimulationConfiguration) => {
    const gasCost = ethers.utils.parseEther('0.0001');
    const { numberOfAccounts } = config;
    console.log('Creating withdraw users from HD wallet ...');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);

    console.log(`Creating ${txCount} withdrawals ...`);
    const preparedWithdrawals: PreparedWithdrawal[] = await generateWithdrawals(txCount, users);
    console.log(`Created ${preparedWithdrawals.length} withdrawals`);

    let totalNeeded = BigNumber.from(0);
    const neededAmounts = preparedWithdrawals.reduce((accounts, { from, amount, ethAddress }) => {
        if (accounts.has(ethAddress)) {
            accounts.set(ethAddress, { wallet: from, total: accounts.get(ethAddress).total.add(amount) });
            totalNeeded.add(amount);
        } else {
            accounts.set(ethAddress, { wallet: from, total: amount });
            totalNeeded.add(amount);
        }

        return accounts;
    }, new Map<String, { wallet: RollupWallet; total: BigNumber }>());

    console.log(`Ensuring L1 & L2 funds for ${neededAmounts.size} users...`);
    await ensureRollupFunds(totalNeeded, funderL2Wallet);
    let accountIdx = 0;
    for (const { wallet, total: amount } of neededAmounts.values()) {
        process.stdout.write((accountIdx++).toString() + ',');
        await ensureRollupFundsFromRollup(amount.add(gasCost), funderL2Wallet, wallet);
        await ensureL2AccountActivation(wallet);
    }
    process.stdout.write('\n');

    const executedTx: Transaction[] = await Promise.all(await executeWithdrawals(preparedWithdrawals, txDelay));

    console.log(`Executed ${executedTx.length} withdrawals`);
    console.time('Withdrawals execution');
    await resolveWithdrawTransactions(executedTx);
    console.timeEnd('Withdrawals execution');
};

export { runSimulation as runWithdrawSimulation };
