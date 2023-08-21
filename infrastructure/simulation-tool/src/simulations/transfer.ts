import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { ensureL1Funds, ensureRollupFunds } from '../operations/common';
import {
    PreparedTransfer,
    executeTransfers,
    generateTransfersToExisting,
    resolveTransactions
} from '../operations/transfer';
import config from '../utils/config.utils';
import { generateWallets } from '../utils/wallet.utils';
import { SimulationConfiguration } from './setup';

const runSimulation = async ({ walletGenerator, txCount, txDelay, funderL2Wallet }: SimulationConfiguration) => {
    console.time('total time');
    const { numberOfAccounts } = config;
    // Create users
    console.log('Creating transfer users from HD wallet ...');
    console.time('users');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts, walletGenerator);
    for (const [i, user] of users.entries()) {
        console.log(`User ${i} @ ${user.address()}}`);
        const isActive = (await user.isSigningKeySet()) && Boolean(await user.getAccountId());
        if (!isActive) {
            // deposit and set signing key
            const { totalFee } = await user.provider.getTransactionFee(
                { ChangePubKey: 'ECDSA' },
                user.address(),
                'RBTC'
            );
            await (
                await funderL2Wallet.depositToSyncFromRootstock({
                    amount: totalFee.mul(2),
                    depositTo: user.address(),
                    token: 'RBTC'
                })
            ).awaitRootstockTxCommit();
            await (
                await user.setSigningKey({
                    ethAuthType: 'ECDSA',
                    feeToken: 'RBTC',
                    fee: totalFee
                })
            ).awaitReceipt();
        }
    }
    console.timeEnd('users');
    console.log(`Created ${users.length} users.`);

    // Create transactions
    console.log(`Creating ${txCount} transfers ...`);
    console.time('tx preparation');
    const preparedTransfers: PreparedTransfer[] = generateTransfersToExisting(txCount, users);
    console.timeEnd('tx preparation');
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions
    console.log('Verifying transactions ...');
    type CostAccumulator = {
        total: BigNumber;
        accountTotalCost: Map<RollupWallet, BigNumber>;
    };

    let costs: CostAccumulator = {
        total: constants.Zero,
        accountTotalCost: new Map()
    };

    console.time('collect amounts');
    for (const { amount, from } of preparedTransfers) {
        const { totalFee } = await from.provider.getTransactionFee('Transfer', from.address(), 'RBTC');
        const totalCost = amount.add(totalFee);
        costs.total = costs.total.add(totalCost);
        const accountCost = costs.accountTotalCost.get(from) ?? constants.Zero;
        costs.accountTotalCost.set(from, accountCost.add(totalFee));
    }
    console.timeEnd('collect amounts');

    console.time('funding');
    await ensureRollupFunds(costs.total, funderL2Wallet);
    let i = 0;
    for (const [account, cost] of costs.accountTotalCost) {
        console.log(i++);
        await ensureL1Funds(funderL2Wallet._ethSigner)(cost, account._ethSigner);
        await ensureRollupFunds(cost, account);
    }
    console.timeEnd('funding');
    console.log('Verified transactions.');

    // Execute transactions
    console.time('execution');
    const executedTx: Transaction[] = await Promise.all(await executeTransfers(preparedTransfers, txDelay));
    console.timeEnd('execution');

    // List execution results
    console.time('resolution');
    await resolveTransactions(executedTx);
    console.timeEnd('resolution');
    console.timeEnd('total time');
};

export { runSimulation as runTransferSimulation };
