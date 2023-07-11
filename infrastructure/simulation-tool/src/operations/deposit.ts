import { BigNumber, constants, ContractReceipt, Wallet as EthersWallet } from 'ethers';
import config from '../config';
import { getRandomBigNumber } from '../numberUtils';
import { Wallet as RollupWallet, RootstockOperation, Signer } from '@rsksmart/rif-rollup-js-sdk';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';
import { chooseRandomWallet } from './utils';

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
    const [minAmount, maxAmount] = config.weiLimits.deposit;;

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

const getDepositResult = async (deposit: RootstockOperation): Promise<DepositResult> => {
    const opL1Receipt = await deposit.awaitRootstockTxCommit();
    const opL2Receipt = await deposit.awaitReceipt();
    const verifierReceipt = await deposit.awaitVerifyReceipt();

    return {
        opL1Receipt,
        opL2Receipt,
        verifierReceipt
    };
};

const generateDeposits = (
    numberOfDeposits: number,
    funderL2Wallet: RollupWallet,
    recepients: EthersWallet[]
): PreparedDeposit[] => {
    return [...Array(numberOfDeposits)].map(() => prepareDeposit(funderL2Wallet, chooseRandomWallet(recepients)));
};

const depositToSelf = async (l1wallet: EthersWallet, l2wallet: RollupWallet, amount?: BigNumber): Promise<DepositResult> => {
    const preparedDeposit = prepareDeposit(l2wallet, l1wallet, amount);
    const deposit = await executeDeposit(preparedDeposit);
    return getDepositResult(deposit);
};

export type { PreparedDeposit, DepositResult };
export { prepareDeposit, executeDeposit, getDepositResult, generateDeposits, depositToSelf };
