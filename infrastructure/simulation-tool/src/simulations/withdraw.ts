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
    const gasCost = ethers.utils.parseEther('0.001');
    const { numberOfAccounts } = config;
    console.log('Creating withdraw users from HD wallet ...');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);

    console.log(`Creating ${txCount} withdrawals ...`);
    const preparedWithdrawals: PreparedWithdrawal[] = await generateWithdrawals(txCount, users);
    console.log(`Created ${preparedWithdrawals.length} withdrawals`);

    let totalNeeded = BigNumber.from(0);
    const neededAmounts = preparedWithdrawals.reduce((accounts, { from, amount, ethAddress }) => {
        if (accounts.has(ethAddress)) {
            accounts.set(ethAddress, [from, accounts.get(ethAddress)[1].add(amount)]);
            totalNeeded.add(amount);
        } else {
            accounts.set(ethAddress, [from, amount]);
            totalNeeded.add(amount);
        }

        return accounts;
    }, new Map<String, [RollupWallet, BigNumber]>());

    console.log(`Ensuring L1 & L2 funds for ${neededAmounts.size} users...`);
    await ensureRollupFunds(totalNeeded, funderL2Wallet);
    let accountIdx = 0;
    for (const [wallet, amount] of neededAmounts.values()) {
        process.stdout.write((accountIdx++).toString() + ',');
        await ensureRollupFundsFromRollup(amount.add(gasCost), funderL2Wallet, wallet);
        await ensureL2AccountActivation(wallet);
    }
    process.stdout.write('\n');

    const executedTx: Transaction[] = await Promise.all(await executeWithdrawals(preparedWithdrawals, txDelay));

    console.log(`Executed ${executedTx.length} withdrawals`);
    await resolveWithdrawTransactions(executedTx);
};

export { runSimulation as runWithdrawSimulation };
