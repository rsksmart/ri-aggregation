import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber } from 'ethers';
import { getRandomBigNumber } from '../utils/number.utils';
import config from '../utils/config.utils';
import { getRandomElement } from './common';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

type PreparedWithdrawal = Omit<Parameters<RollupWallet['withdrawFromSyncToRootstock']>, 'amount'>[number] & {
    amount: BigNumber;
    from: RollupWallet;
};

type WithdrawResult = {
    opL2Receipt: TransactionReceipt;
    verifyReceipt: TransactionReceipt;
};

const prepareWithdrawal = (recipient: RollupWallet, amount?: BigNumber): PreparedWithdrawal => {
    let [minAmount, maxAmount] = config.weiLimits.withdraw;
    const value = amount || utils.closestPackableTransactionAmount(getRandomBigNumber(minAmount, maxAmount));

    return {
        ethAddress: recipient.address(),
        amount: value,
        token: 'RBTC',
        from: recipient
    };
};

const generateWithdrawals = (numberOfWithdrawals: number, users: RollupWallet[]): PreparedWithdrawal[] => {
    return [...Array(numberOfWithdrawals)].map((_, i) => {
        process.stdout.write(`${i},`);
        return prepareWithdrawal(getRandomElement(users));
    });
};

const executeWithdrawal = async ({ from, ...preparedWithdrawal }: PreparedWithdrawal): Promise<Transaction> => {
    // console.log(`Withdrawing ${preparedWithdrawal.amount} RBTC from ${from.address()}`);
    // commented out to reduce noise (TODO: create more sophisticated logging)
    return from.withdrawFromSyncToRootstock(preparedWithdrawal);
};

const executeWithdrawals = async (
    preparedWithdrawals: PreparedWithdrawal[],
    delay: number
): Promise<Promise<Transaction>[]> => {
    console.log('Executing withdrawals: ');

    let transactions: Promise<Transaction>[] = [];
    const shouldSleep = (i: number) => preparedWithdrawals.length - 1 > i;
    for (const [i, preparedWithdrawal] of preparedWithdrawals.entries()) {
        process.stdout.write(`${i},`);
        transactions.push(executeWithdrawal(preparedWithdrawal));

        shouldSleep(i) && (await sleep(delay));
    }

    return transactions;
};

const resolveTransaction = async (executedTx: Transaction): Promise<WithdrawResult> => {
    try {
        const receipt = await executedTx.awaitReceipt();
        console.log(
            `Transaction with hash #${executedTx.txHash} ${
                receipt.success ? 'added' : 'failed with: ' + receipt.failReason
            } in block #${receipt.block.blockNumber}.`
        );

        return {
            opL2Receipt: receipt,
            verifyReceipt: null
        };
    } catch (e) {
        console.error(e);
    }
};

const resolveTransactions = async (executedTx: Transaction[]) => {
    // TODO: move to some L2 utils
    console.log('Resolving transactions: ');

    return await Promise.all(executedTx.map(resolveTransaction));
};

export {
    prepareWithdrawal,
    generateWithdrawals,
    executeWithdrawals,
    executeWithdrawal,
    resolveTransaction as resolveWithdrawTransaction,
    resolveTransactions as resolveWithdrawTransactions
};
export type { PreparedWithdrawal };
