import { BigNumber, Signer } from 'ethers';
import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { depositToSelf } from '../simulations/setup';

const ensureL1Funds = (funder: Signer) => async (totalDepositAmount: BigNumber, account: Signer) => {
    const accountBalance = await account.getBalance();
    if (accountBalance.lt(totalDepositAmount)) {
        console.log(
            `Funding account ${await account.getAddress()} with ${totalDepositAmount
                .sub(accountBalance)
                .toString()} RBTC from funder ${await funder.getAddress()}`
        );

        const latestBlock = await funder.provider.getBlock('latest');
        const gasLimit = latestBlock.gasLimit;
        const gasPrice = await funder.provider.getGasPrice();

        const tx = await funder.sendTransaction({
            to: await account.getAddress(),
            value: totalDepositAmount.sub(accountBalance).mul(gasLimit).mul(gasPrice),
            gasLimit
        });
        await tx.wait();
        console.log(
            `Account ${await account.getAddress()} now has ${await account.getBalance()} RBTC after funding to add to the total of ${totalDepositAmount.toString()} RBTC`
        );
    }
};

const ensureRollupFunds = async (totalDepositAmount: BigNumber, l2Wallet: RollupWallet) => {
    if (totalDepositAmount.gt(await l2Wallet.getBalance('RBTC'))) {
        await depositToSelf(l2Wallet, totalDepositAmount);
    }
};

const getRandomElement = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

export { ensureRollupFunds, getRandomElement, ensureL1Funds };
