import { Wallet as RollupWallet, RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { BigNumber, constants, ContractReceipt, Wallet as EthersWallet } from 'ethers';
import config from '../utils/config.utils';
import { getRandomBigNumber } from '../utils/number.utils';
import { chooseRandomWallet } from '../utils/wallet.utils';
import { sleep } from '@rsksmart/rif-rollup-js-sdk/build/utils';

type PreparedDeposit = Omit<Parameters<RollupWallet['depositToSyncFromRootstock']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type DepositResult = {
    opL1Receipt: ContractReceipt;
    opL2Receipt: PriorityOperationReceipt;
    verifierReceipt: PriorityOperationReceipt;
};

const prepareDeposit = (l2sender: RollupWallet, l1recipient: EthersWallet, amount?: BigNumber): PreparedDeposit => {
    const [minAmount, maxAmount] = config.weiLimits.deposit;

    return {
        amount: amount || getRandomBigNumber(minAmount, maxAmount),
        depositTo: l1recipient.address,
        token: constants.AddressZero,
        from: l2sender
    };
};

const executeDeposit = (preparedDeposit: PreparedDeposit): Promise<RootstockOperation> => {
    const { from, ...depositParameters } = preparedDeposit;
    console.log(`Depositing ${depositParameters.amount} RBTC to L2 ...`);

    return from.depositToSyncFromRootstock(depositParameters);
};

const resolveRootstockOperation = async (rskOperation: RootstockOperation): Promise<DepositResult> => {
    const opL1Receipt: ContractReceipt = await rskOperation.awaitRootstockTxCommit();
    console.log(
        `Rollup contract for RSK operation with hash #${rskOperation.ethTx.blockHash} ${
            opL1Receipt.status ? 'submitted' : 'rejected'
        }`
    );
    const opL2Receipt: PriorityOperationReceipt = await rskOperation.awaitReceipt();
    console.log(
        `Priority operation with hash #${rskOperation.ethTx.blockHash} ${
            opL2Receipt.executed ? 'executed' : 'failed'
        } in block #${opL2Receipt.block.blockNumber}.`
    );

    console.log('Waiting for block verification ...');
    const verifierReceipt = await rskOperation.awaitVerifyReceipt();
    console.log(
        `Verification of block #${verifierReceipt.block.blockNumber} ${
            verifierReceipt.block.verified ? 'successfull' : 'failed'
        }.`
    );

    return {
        opL1Receipt,
        opL2Receipt,
        verifierReceipt
    };
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
    recepients: EthersWallet[]
): PreparedDeposit[] => {
    console.log('🦆: numberOfDeposits:', numberOfDeposits);
    return [...Array(numberOfDeposits)].map(() => prepareDeposit(funderL2Wallet, chooseRandomWallet(recepients)));
};

const depositToSelf = async (
    l1wallet: EthersWallet,
    l2wallet: RollupWallet,
    amount?: BigNumber
): Promise<DepositResult> => {
    const preparedDeposit = prepareDeposit(l2wallet, l1wallet, amount);
    const deposit = await executeDeposit(preparedDeposit);
    return resolveRootstockOperation(deposit);
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
    generateDeposits,
    resolveDeposits,
    resolveRootstockOperation as resolveDeposit,
    prepareDeposit,
    executeDeposits
};
export type { DepositResult, PreparedDeposit };
