import { PreparedWithdrawal, executeWithdrawals, generateWithdrawals, resolveWithdrawTransactions } from '../operations/withdraw';
import { SimulationConfiguration } from './setup';
import config from '../utils/config.utils';
import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { generateWallets } from '../utils/wallet.utils';
import { ensureL1Funds, ensureL2AccountActivation, ensureRollupFunds } from '../operations/common';
import { BigNumber, constants } from 'ethers';

const runSimulation = async ({ txCount, txDelay, walletGenerator, funderL2Wallet }: SimulationConfiguration) => {
    const oneRBTC = BigNumber.from('1000000000000000000');
    const { numberOfAccounts } = config;
    console.log('Creating deposit users from HD wallet ...');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);

    console.log(`Creating ${txCount} withdrawals ...`);
    const preparedWithdrawals: PreparedWithdrawal[] = await generateWithdrawals(txCount, users);
    console.log(`Created ${preparedWithdrawals.length} withdrawals`);

    console.log(`Ensure L1 & L2 funds for ${users.length} users and L2 account activation...`);
    const ensureAccountFunds = ensureL1Funds(funderL2Wallet._ethSigner);
    const activationList = preparedWithdrawals.map(async ({from, amount}, idx) => {
        await ensureAccountFunds(amount.add(oneRBTC), from._ethSigner);
        await ensureRollupFunds(amount.add(oneRBTC), from);
        await ensureL2AccountActivation(from);
    });
    await Promise.all(activationList);

    const executedTx: Transaction[] = await Promise.all(
        await executeWithdrawals(preparedWithdrawals, txDelay)
    )

    console.log(`Executed ${executedTx.length} withdrawals`)
    await resolveWithdrawTransactions(executedTx);
};

export { runSimulation as runWithdrawSimulation };
