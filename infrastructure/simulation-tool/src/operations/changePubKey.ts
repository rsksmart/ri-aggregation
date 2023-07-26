import { Wallet as RollupWallet, Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { constants } from 'ethers';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { RollupWalletGenerator } from '../utils/wallet.utils';
import { TransactionReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

type PreparedPubKeyChange = Parameters<RollupWallet['setSigningKey']>[number] & {
    from: RollupWallet;
};

type ResolvedPubKeyChange = {
    tx: Transaction;
    receipt: TransactionReceipt;
    verifyReceipt: TransactionReceipt;
};

const preparePubKeyChange = (l2sender: RollupWallet): PreparedPubKeyChange => ({
    from: l2sender,
    ethAuthType: 'ECDSA',
    feeToken: constants.AddressZero
});

const generatePubKeyChanges = async (
    txCount: number,
    walletGenerator: RollupWalletGenerator
): Promise<PreparedPubKeyChange[]> => {
    let preparedPubKeyChanges: PreparedPubKeyChange[] = [];
    while (preparedPubKeyChanges.length < txCount) {
        const { value: l2Account } = await walletGenerator.next();
        const hasKeySet = await l2Account.isSigningKeySet();
        if (!hasKeySet) {
            preparedPubKeyChanges = [...preparedPubKeyChanges, preparePubKeyChange(l2Account)];
        }
    }
    return preparedPubKeyChanges;
};

const executePubKeyChange = async (preparedPubKeyChanges: PreparedPubKeyChange): Promise<Transaction> => {
    const { from, ...changePubKeyParameters } = preparedPubKeyChanges;

    return from.setSigningKey(changePubKeyParameters);
};

const executePubKeyChanges = async (
    preparedChangePubKey: PreparedPubKeyChange[],
    delay: number
): Promise<Promise<Transaction>[]> => {
    const executedTx: Promise<Transaction>[] = [];
    console.log('Executing change-public-key simulations: ');
    for (const [i, pubKeyChange] of preparedChangePubKey.entries()) {
        const promiseOfTx = executePubKeyChange(pubKeyChange);
        executedTx.push(promiseOfTx);
        process.stdout.write(`${i},`);
        preparedChangePubKey.length - 1 === i || (await sleep(delay));
    }

    return executedTx;
};

const resolveTransaction = async (tx: Transaction): Promise<ResolvedPubKeyChange> => {
    const receipt = await tx.awaitReceipt();
    const verifyReceipt = await tx.awaitVerifyReceipt();

    return { tx, receipt, verifyReceipt };
};

const resolvePubKeyChanges = async (executedTx: Transaction[]): Promise<ResolvedPubKeyChange[]> => {
    console.log('Resolving change-public-key simulations: ');

    const resolvedPubKeyChanges: ResolvedPubKeyChange[] = await Promise.all(
        executedTx.map(async (tx, i) => {
            process.stdout.write(`${i},`);
            return await resolveTransaction(tx);
        })
    );

    return resolvedPubKeyChanges;
};

export type { PreparedPubKeyChange, ResolvedPubKeyChange };

export {
    preparePubKeyChange,
    generatePubKeyChanges,
    executePubKeyChange,
    executePubKeyChanges,
    resolveTransaction,
    resolvePubKeyChanges
};
