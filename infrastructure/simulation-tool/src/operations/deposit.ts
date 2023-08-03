import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber, ContractReceipt, Wallet as EthersWallet, Signer } from 'ethers';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { Address, PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { getRandomElement } from './common';

type PreparedDeposit = Omit<Parameters<RollupWallet['depositToSyncFromRootstock']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type DepositResult = {
    opL1Receipt: ContractReceipt;
    opL2Receipt: PriorityOperationReceipt;
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

const getNonceFor = (signer: Signer): Promise<number> => signer.getTransactionCount('pending');

const executeDeposits = async (
    preparedDeposits: PreparedDeposit[],
    delay: number
): Promise<Promise<RootstockOperation>[]> => {
    console.log('Executing deposits: ');

    const nonceMap = new Map<Address, number>();

    for (const [i, preparedDeposit] of preparedDeposits.entries()) {
        // we could use 'pending' if necessary, for now it's the same
        const address = preparedDeposit.from.address();
        const currentNonce = nonceMap.get(address) ?? 0;
        nonceMap.set(
            preparedDeposit.from.address(),
            currentNonce ? currentNonce + 1 : await getNonceFor(preparedDeposit.from.ethSigner())
        );
        console.log(
            i,
            '🦆 ~ file: deposit.ts:64 ~ new nonce:',
            currentNonce ? currentNonce + 1 : await getNonceFor(preparedDeposit.from.ethSigner()),
            'for:',
            address
        );
    }

    let transactions: Promise<RootstockOperation>[] = [];
    const shouldSleep = (i: number) => prepareDeposit.length - 1 > i;
    for (const [i, preparedDeposit] of preparedDeposits.entries()) {
        process.stdout.write(`${i},`);
        // console.log("🦆 ~ file: deposit.ts:68 ~ firstNonce + i:", nonceMap.get(preparedDeposit.from.address()))
        transactions.push(
            executeDeposit({
                ...preparedDeposit,
                ethTxOptions: {
                    ...preparedDeposit.ethTxOptions,
                    nonce: nonceMap.get(preparedDeposit.from.address())
                }
            })
                .then((tx) => {
                    console.log(`Deposit #${i} submitted.`, tx.state);
                    return tx;
                })
                .catch((e) => {
                    console.error(`Deposit #${i} failed with: ${e}`);
                    return e;
                })
        );

        shouldSleep(i) && (await sleep(delay));
    }

    return transactions;
};

const resolveRootstockOperation = async (rskOperation: RootstockOperation): Promise<DepositResult> => {
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
    const verifyReceipt = await rskOperation.awaitVerifyReceipt();
    console.log(
        `Priority operation with hash #${opL1Receipt.blockHash} ${
            verifyReceipt?.block?.verified ? 'verified' : 'failed to verify'
        } in L2 block #${verifyReceipt?.block?.blockNumber}.`
    );

    return {
        opL1Receipt,
        opL2Receipt
    };
};

const depositToSelf = async (funderL2Wallet: RollupWallet, amount: BigNumber) => {
    const depositParams = prepareDeposit(funderL2Wallet, null, amount);
    const [promiseOfDeposit] = await executeDeposits([depositParams], 0);
    const receipt = await (await promiseOfDeposit).awaitReceipt();
    console.log('🦆 ~ file: deposit.ts:105 ~ depositToSelf ~ receipt:', receipt);
};

const resolveDeposits = async (executedTx: RootstockOperation[]) => {
    console.log('Resolving rootstock operations: ');

    return executedTx.map(resolveRootstockOperation);
};

export {
    depositToSelf,
    executeDeposit,
    executeDeposits,
    generateDeposits,
    prepareDeposit,
    resolveRootstockOperation,
    resolveDeposits
};
export type { DepositResult, PreparedDeposit };
