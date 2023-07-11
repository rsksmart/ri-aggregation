import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { DepositResult, executeDeposit, getDepositResult, prepareDeposit } from '../operations/deposit';
import { Wallet as EthersWallet } from 'ethers';

const depositToSelf = async (l1wallet: EthersWallet, l2wallet: RollupWallet): Promise<DepositResult> => {
    const preparedDeposit = prepareDeposit(l2wallet, l1wallet);
    const deposit = await executeDeposit(preparedDeposit);
    return getDepositResult(deposit);
};

export { depositToSelf };
