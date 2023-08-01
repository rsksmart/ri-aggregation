import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';
import { BigNumber, ContractReceipt, Wallet as EthersWallet, constants } from 'ethers';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { chooseRandomWallet } from '../utils/wallet.utils';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

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

    return {
        amount: amount || getRandomBigNumber(minAmount, maxAmount),
        depositTo: recipientAddress || l2sender.address(),
        token: 'RBTC',
        from: l2sender
    };
};

const executeDeposit = (preparedDeposit: PreparedDeposit): Promise<RootstockOperation> => {
    const { from, ...depositParameters } = preparedDeposit;
    // console.log(`Depositing ${depositParameters.amount} RBTC to L2 ...`); // commented out to reduce noise (TODO: create more sophisticated logging)

    return from.depositToSyncFromRootstock(depositParameters);
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

    return {
        opL1Receipt,
        opL2Receipt
    };
};

const depositToSelf = async (funderL2Wallet: RollupWallet, amount: BigNumber) => {
    const depositParams = prepareDeposit(funderL2Wallet, null, amount);
    const promiseOfDeposit = await (await executeDeposits([depositParams], 0)).at(0);
    await promiseOfDeposit.awaitReceipt();
};

const resolveDeposits = async (executedTx: Promise<RootstockOperation>[]) => {
    // TODO: move to some L1 utils
    console.log('Resolving rootstock operations: ');
    for (const txPromise of executedTx) {
        await resolveRootstockOperation(await txPromise);
    }
};

const generateDeposits = (
    numberOfDeposits: number,
    funderL2Wallet: RollupWallet,
    recipients: EthersWallet[]
): PreparedDeposit[] => {
    return [...Array(numberOfDeposits)].map(() =>
        prepareDeposit(funderL2Wallet, chooseRandomWallet(recipients).address)
    );
};

const executeDeposits = async (
    preparedDeposits: PreparedDeposit[],
    delay: number
): Promise<Promise<RootstockOperation>[]> => {
    const executedTx: Promise<RootstockOperation>[] = [];
    console.log('Executing deposits: ');
    for (const [i, deposit] of preparedDeposits.entries()) {
        const promiseOfDeposit: Promise<RootstockOperation> = executeDeposit(deposit); // We could make an adapter wallet to use a single execute function for all operations
        executedTx.push(promiseOfDeposit);
        process.stdout.write(`${i},`);
        preparedDeposits.length - 1 === i || (await sleep(delay));
    }

    return executedTx;
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
