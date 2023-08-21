import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { Address, PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber, ContractReceipt } from 'ethers';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { getRandomElement } from './common';
import { getNonceFor } from '../utils/wallet.utils';

type PreparedDeposit = Omit<Parameters<RollupWallet['depositToSyncFromRootstock']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type DepositResult = {
    opL1Receipt: ContractReceipt;
    opL2Receipt: PriorityOperationReceipt;
    verifierReceipt: PriorityOperationReceipt;
};

const prepareDeposit = (l2sender: RollupWallet, recipientAddress?: string, amount?: BigNumber): PreparedDeposit => {
    const [minAmount, maxAmount] = config.weiLimits.deposit;
    const value = amount || getRandomBigNumber(minAmount, maxAmount);
    const depositTo = recipientAddress || l2sender.address();
    console.log(`Preparing deposit of ${value} RBTC from ${l2sender.address} to ${depositTo}.`);

    return {
        amount: value,
        depositTo,
        token: 'RBTC',
        from: l2sender
    };
};

const generateDeposits = (numberOfDeposits: number, users: RollupWallet[]): PreparedDeposit[] => {
    return [...Array(numberOfDeposits)].map((_, i) => {
        process.stdout.write(`${i},`);
        return prepareDeposit(getRandomElement(users), getRandomElement(users).address());
    });
};

const executeDeposit = async (preparedDeposit: PreparedDeposit): Promise<RootstockOperation> => {
    const { from, ...depositParameters } = preparedDeposit;
    console.log(
        `Depositing ${depositParameters.amount} RBTC from ${from.address()} with balance ${await from
            .ethSigner()
            .getBalance()} to L2 account ${depositParameters.depositTo} ...`
    ); // commented out to reduce noise (TODO: create more sophisticated logging)

    return from.depositToSyncFromRootstock(depositParameters);
};

const executeDeposits = async (
    preparedDeposits: PreparedDeposit[],
    delay: number
): Promise<Promise<RootstockOperation>[]> => {
    console.log('Executing deposits: ');

    const nonceMap = new Map<Address, number>();

    let transactions: Promise<RootstockOperation>[] = [];
    const shouldSleep = (i: number): boolean => preparedDeposits.length - 1 > i;
    console.time('total execution time');
    for (const [i, preparedDeposit] of preparedDeposits.entries()) {
        console.time('deposit');
        process.stdout.write(`${i},`);

        const nonce = await getNonceFor(preparedDeposit.from._ethSigner, nonceMap);

        transactions.push(
            executeDeposit({
                ...preparedDeposit,
                ethTxOptions: {
                    ...preparedDeposit.ethTxOptions,
                    nonce
                }
            })
        );

        shouldSleep(i) && (await sleep(delay));

        console.timeEnd('deposit');
    }
    console.timeEnd('total execution time');

    return transactions;
};

const resolveRootstockOperation = async (rskOperation: RootstockOperation): Promise<DepositResult> => {
    /* 
     * FIXME:
     *  - we shouldn't have undefined operation here, so we should filter them out before
     *  - we shouldn't always wait for all of those events
     */ 
    if (!rskOperation) {
        console.error('Operation is not defined.');
        return; // prevent throwing error in case of undefined operation
    }
    const opL1Receipt: ContractReceipt = await rskOperation.awaitRootstockTxCommit();
    console.log(
        `Rollup contract for RSK operation with hash #${opL1Receipt.blockHash} ${
            opL1Receipt.status ? 'submitted' : 'rejected'
        }`
    );
    const opL2Receipt: PriorityOperationReceipt = await rskOperation.awaitReceipt();
    console.log(
        `Priority operation with hash #${opL1Receipt.blockHash} ${
            opL2Receipt.executed ? 'executed' : 'failed'
        } in L2 block #${opL2Receipt.block.blockNumber}.`
    );
    const verifierReceipt = await rskOperation.awaitVerifyReceipt();
    console.log(
        `Priority operation with hash #${opL1Receipt.blockHash} ${
            verifierReceipt?.block?.verified ? 'verified' : 'failed to verify'
        } in L2 block #${verifierReceipt?.block?.blockNumber}.`
    );

    return {
        opL1Receipt,
        opL2Receipt,
        verifierReceipt
    };
};

const resolveDeposits = async (executedTx: RootstockOperation[]) => {
    console.log('Resolving rootstock operations: ');

    return Promise.all(executedTx.map(resolveRootstockOperation)).catch((e) => {
        console.trace(e);
    });
};

export {
    executeDeposit,
    executeDeposits,
    generateDeposits,
    prepareDeposit,
    resolveDeposits,
    resolveRootstockOperation
};
export type { DepositResult, PreparedDeposit };
