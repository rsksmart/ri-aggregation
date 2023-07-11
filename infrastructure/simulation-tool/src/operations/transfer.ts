import { BigNumber, Wallet as EthersWallet, constants } from 'ethers';
import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk/';
import config from '../config';
import { getRandomBigNumber } from '../numberUtils';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { chooseRandomWallet } from './utils';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';

type PreparedTransfer = Omit<Parameters<RollupWallet['syncTransfer']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type TransferResult = {
    opL2Receipt: TransactionReceipt;
    verifierReceipt: TransactionReceipt;
};

const prepareTransfer = (l2sender: RollupWallet, recipient: EthersWallet): PreparedTransfer => {
    const [minAmount, maxAmount] = config.weiLimits.transferToNew;
    return {
        from: l2sender,
        to: recipient.address,
        amount: utils.closestPackableTransactionAmount(getRandomBigNumber(minAmount, maxAmount)),
        token: constants.AddressZero,
        nonce: 'committed'
    };
};

const executeTransfer = (preparedTransfer: PreparedTransfer): Promise<Transaction> => {
    const { from, ...transferParameters } = preparedTransfer;
    // console.log(`Transferring ${transferParameters.amount} RBTC to ${transferParameters.to} ...` );

    return from.syncTransfer(transferParameters);
};

const geteTransferResult = async (transfer: Transaction): Promise<TransferResult> => {
    const opL2Receipt = await transfer.awaitReceipt();
    const verifierReceipt = await transfer.awaitVerifyReceipt();

    return {
        opL2Receipt,
        verifierReceipt
    };
};

const generateTransfers = (
    numberOfTransfers: number,
    funderL2Wallet: RollupWallet,
    recepients: EthersWallet[]
): PreparedTransfer[] => {
    return [...Array(numberOfTransfers)].map(() => prepareTransfer(funderL2Wallet, chooseRandomWallet(recepients)));
};

const executeTransfers = async (
    preparedTransfers: PreparedTransfer[],
    funderL2Wallet: RollupWallet,
    delay: number
): Promise<Promise<Transaction>[]> => {
    const executedTx: Promise<Transaction>[] = [];
    for (const [i, transfer] of preparedTransfers.entries()) {
        const promiseOfTransfer = executeTransfer(transfer); // We could make an adapter wallet to use a single execute function for all operations
        executedTx.push(promiseOfTransfer);
        preparedTransfers.length - 1 === i || (await sleep(delay));
    }

    return executedTx;
};

export type { PreparedTransfer, TransferResult };

export { prepareTransfer, executeTransfer, geteTransferResult, generateTransfers, executeTransfers };
