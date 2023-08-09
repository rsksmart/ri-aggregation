import { BigNumber, Signer } from 'ethers';
import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { depositToSelf } from '../simulations/setup';

const ensureL1Funds = (funder: Signer) => async (totalAmount: BigNumber, account: Signer) => {
    const accountBalance = await account.getBalance();
    if (accountBalance.lt(totalAmount)) {
        console.log(
            `Funding account ${await account.getAddress()} with ${totalAmount
                .sub(accountBalance)
                .toString()} RBTC from funder ${await funder.getAddress()}`
        );

        const latestBlock = await funder.provider.getBlock('latest');
        const gasLimit = latestBlock.gasLimit; // FIXME: this is not the correct gas limit
        const gasPrice = await funder.provider.getGasPrice();

        const tx = await funder.sendTransaction({
            to: await account.getAddress(),
            value: totalAmount.sub(accountBalance).add(gasLimit.mul(gasPrice)) // Adds gas cost for a future transaction (totalAmount - balance would not be enough to cover gas cost)
        });
        await tx.wait();
        console.log(
            `Account ${await account.getAddress()} now has ${await account.getBalance()} RBTC after funding to add to the total of ${totalAmount.toString()} RBTC`
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
