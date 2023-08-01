import { BigNumber, constants } from 'ethers';
import { depositToSelf } from './deposit';
import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';

const ensureFunds = async (totalDepositAmount: BigNumber, l2Wallet: RollupWallet) => {
    if (totalDepositAmount.gt(await l2Wallet.getBalance('RBTC'))) {
        await depositToSelf(l2Wallet, totalDepositAmount);
    }
};

export { ensureFunds };
