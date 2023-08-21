import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk/';
import { Address, TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber } from 'ethers';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { getRandomElement } from './common';

type PreparedTransfer = Omit<Parameters<RollupWallet['syncTransfer']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type TransferResult = {
    opL2Receipt: TransactionReceipt;
    verificationL2Receipt?: TransactionReceipt;
};

const prepareTransfer = (l2sender: RollupWallet, recipient: Address, amount?: BigNumber): PreparedTransfer => {
    const [minAmount, maxAmount] = config.weiLimits.transfer;
    const value = amount || utils.closestPackableTransactionAmount(getRandomBigNumber(minAmount, maxAmount));
    console.log(`Preparing transfer of ${value} RBTC from ${l2sender.address()} to ${recipient}.`);
    return {
        from: l2sender,
        to: recipient,
        amount: value,
        token: 'RBTC',
        nonce: 'committed'
    };
};

const executeTransfer = (preparedTransfer: PreparedTransfer): Promise<Transaction> => {
    const { from, ...transferParameters } = preparedTransfer;
    console.log(
        `Transferring ${transferParameters.amount} RBTC from ${from.address()} to ${transferParameters.to} ...`
    ); // (TODO: create more sophisticated logging)

    return from.syncTransfer(transferParameters);
};

const generateTransfersToExisting = (numberOfTransfers: number, users: RollupWallet[]): PreparedTransfer[] =>
    [...Array(numberOfTransfers)].map((_, i) => {
        process.stdout.write(`${i},`);

        return prepareTransfer(getRandomElement(users), getRandomElement(users).address());
    });

const generateTransfersToNew = (numberOfTransfers: number, users: RollupWallet[]): PreparedTransfer[] => {
    const [funder, ...receipts] = users;

    return [...Array(numberOfTransfers)].map((_, i) => {
        process.stdout.write(`${i},`);

        return prepareTransfer(funder, getRandomElement(receipts).address());
    });
};

const executeTransfers = async (
    preparedTransfers: PreparedTransfer[],
    delay: number
): Promise<Promise<Transaction>[]> => {
    console.log('Executing transfers: ');
    let nonceMap = new Map<Address, number>();
    const executedTx: Promise<Transaction>[] = [];
    const shouldSleep = (i: number) => preparedTransfers.length - 1 > i;
    for (let [i, transfer] of preparedTransfers.entries()) {
        const senderAddress = transfer.from.address();
        const nonce = nonceMap.has(senderAddress)
            ? nonceMap.get(senderAddress) + 1
            : await transfer.from.getNonce('committed');
        nonceMap.set(senderAddress, nonce);
        process.stdout.write(`${i},`);
        executedTx.push(executeTransfer({ ...transfer, nonce }));
        shouldSleep(i) && (await sleep(delay));
    }

    return executedTx;
};

const resolveTransaction = async (executedTx: Transaction): Promise<TransferResult> => {
    const opL2Receipt = await executedTx.awaitReceipt();
    const verificationL2Receipt = null; //await executedTx.awaitVerifyReceipt();

    return {
        opL2Receipt,
        verificationL2Receipt
    };
};

const resolveTransactions = async (executedTx: Transaction[]) => {
    console.log('Resolving transactions: ');

    let receipts: TransferResult[] = [];
    for (const [i, tx] of executedTx.entries()) {
        const opL2Receipt = await tx.awaitReceipt();
        console.log(
            `Transaction #${i} with hash #${tx.txHash} ${
                opL2Receipt.success ? 'added' : 'failed with: ' + opL2Receipt.failReason
            } in block #${opL2Receipt.block.blockNumber}.`
        );
        const verificationL2Receipt = null; //await tx.awaitVerifyReceipt();
        receipts = [
            ...receipts,
            {
                opL2Receipt,
                verificationL2Receipt
            }
        ];
    }

    return receipts;
};

export type { PreparedTransfer, TransferResult };

export {
    executeTransfer,
    executeTransfers,
    generateTransfersToExisting,
    generateTransfersToNew,
    prepareTransfer,
    resolveTransaction,
    resolveTransactions
};
