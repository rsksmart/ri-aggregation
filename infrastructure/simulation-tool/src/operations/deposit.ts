import { BigNumber, constants, ContractReceipt, Wallet as EthersWallet } from 'ethers';
import config from '../config';
import { getRandomBigNumber } from '../numberUtils';
import { Wallet as RollupWallet, RootstockOperation, Signer } from '@rsksmart/rif-rollup-js-sdk';
import { PriorityOperationReceipt } from '@rsksmart/rif-rollup-js-sdk/build/types';

type PreparedDeposit = Omit<Parameters<RollupWallet['depositToSyncFromRootstock']>[number], 'amount'> & {
    amount: BigNumber;
    from: RollupWallet;
};

type DepositResult = {
    opL1Receipt: ContractReceipt;
    opL2Receipt: PriorityOperationReceipt;
    verifierReceipt: PriorityOperationReceipt;
};

const prepareDeposit = (l2sender: RollupWallet, l1recipient: EthersWallet): PreparedDeposit => {
    const [minAmount, maxAmount] = config.weiLimits.deposit;
    const amount = getRandomBigNumber(minAmount, maxAmount);

    return {
        amount,
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

export type { PreparedDeposit, DepositResult };
export { prepareDeposit, executeDeposit, getDepositResult };
