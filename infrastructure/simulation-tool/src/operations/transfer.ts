import { BigNumber, Wallet as EthersWallet, constants } from 'ethers';
import { Wallet as RollupWallet, Transaction, utils } from '@rsksmart/rif-rollup-js-sdk/';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { chooseRandomWallet } from '../utils/wallet.utils';

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
    // console.log(`Transferring ${transferParameters.amount} RBTC to ${transferParameters.to} ...` ); // commented out to reduce noise (TODO: create more sophisticated logging)

    return from.syncTransfer(transferParameters);
};

const generateTransfers = (
    numberOfTransfers: number,
    funderL2Wallet: RollupWallet,
    recipients: EthersWallet[]
): PreparedTransfer[] => {
    return [...Array(numberOfTransfers)].map(() => prepareTransfer(funderL2Wallet, chooseRandomWallet(recipients)));
};

const executeTransfers = async (
    preparedTransfers: PreparedTransfer[],
    delay: number
): Promise<Promise<Transaction>[]> => {
    const executedTx: Promise<Transaction>[] = [];
    console.log('Executing transfers: ');
    for (const [i, transfer] of preparedTransfers.entries()) {
        const promiseOfTransfer = executeTransfer(transfer); // We could make an adapter wallet to use a single execute function for all operations
        executedTx.push(promiseOfTransfer);
        process.stdout.write(`${i},`);
        preparedTransfers.length - 1 === i || (await sleep(delay));
    }

    return executedTx;
};

const resolveTransactions = async (executedTx: Promise<Transaction>[]) => {
    // TODO: move to some L2 utils
    console.log('Resolving transactions: ');
    for (const [i, txPromise] of executedTx.entries()) {
        const tx = await txPromise;
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

export { prepareTransfer, executeTransfer, generateTransfers, executeTransfers, resolveTransactions };
