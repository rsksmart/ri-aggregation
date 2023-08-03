import { BigNumber } from 'ethers';
import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk/';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { Address, TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { getRandomElement } from './common';

type PreparedTransfer = Omit<Parameters<RollupWallet['syncTransfer']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type TransferResult = {
    opL2Receipt: TransactionReceipt;
};

const prepareTransfer = (l2sender: RollupWallet, recipient: Address, amount?: BigNumber): PreparedTransfer => {
    const [minAmount, maxAmount] = config.weiLimits.transferToNew;
    const value = amount || utils.closestPackableTransactionAmount(getRandomBigNumber(minAmount, maxAmount));
    console.log(`Preparing transfer of ${amount} RBTC from ${l2sender.address} to ${recipient}.`);
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
    ); // commented out to reduce noise (TODO: create more sophisticated logging)

    return from.syncTransfer(transferParameters);
};

const generateTransfers = (numberOfTransfers: number, users: RollupWallet[]): PreparedTransfer[] =>
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
    let firstNonce = await preparedTransfers[0].from.getNonce('committed');
    const executedTx: Promise<Transaction>[] = [];
    const shouldSleep = (i: number) => preparedTransfers.length - 1 > i;
    for (let [i, transfer] of preparedTransfers.entries()) {
        process.stdout.write(`${i},`);
        executedTx.push(executeTransfer({ ...transfer, nonce: firstNonce + i }));
        shouldSleep(i) && (await sleep(delay));
    }

    return executedTx;
};

const resolveTransaction = async (executedTx: Transaction): Promise<TransferResult> => {
    const receipt = await executedTx.awaitReceipt();
    console.log(
        `Transaction with hash #${executedTx.txHash} ${
            receipt.success ? 'added' : 'failed with: ' + receipt.failReason
        } in block #${receipt.block.blockNumber}.`
    );
    console.log('Waiting for block verification ...');
    // const verification = await executedTx.awaitVerifyReceipt();
    // console.log(
    //     `Verification of block #${verification.block.blockNumber} ${
    //         verification.success ? 'successful' : 'failed with: ' + verification.failReason
    //     }.`
    // );

    return {
        opL2Receipt: receipt
    };
};

const resolveTransactions = async (executedTx: Transaction[]) => {
    // TODO: move to some L2 utils
    console.log('Resolving transactions: ');

    return executedTx.map(resolveTransaction);

    for (const [i, tx] of executedTx.entries()) {
        const receipt = await tx.awaitReceipt();
        console.log(
            `Transaction #${i} with hash #${tx.txHash} ${
                receipt.success ? 'added' : 'failed with: ' + receipt.failReason
            } in block #${receipt.block.blockNumber}.`
        );
        console.log('Waiting for block verification ...');
        const verification = await tx.awaitVerifyReceipt();
        console.log(
            `Verification of block #${verification.block.blockNumber} ${
                verification.success ? 'successful' : 'failed with: ' + verification.failReason
            }.`
        );
    }
};

export type { PreparedTransfer, TransferResult };

export {
    prepareTransfer,
    executeTransfer,
    generateTransfers,
    generateTransfersToNew,
    executeTransfers,
    resolveTransactions,
    resolveTransaction as resolveTransfer
};
