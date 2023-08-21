import { BigNumber, Signer } from 'ethers';
import { Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { depositToSelf } from '../simulations/setup';

const ensureL1Funds = (funder: Signer) => async (amount: BigNumber, account: Signer) => {
    const accountBalance = await account.getBalance();
    if (accountBalance.lt(amount)) {
        const latestBlock = await funder.provider.getBlock('latest');
        const gasLimit = latestBlock.gasLimit;
        const gasPrice = await funder.provider.getGasPrice();
        const gasCost = gasPrice.mul(gasLimit);
        // Adds gas cost for a future transaction (totalAmount - balance would not be enough to cover gas cost);
        const value = amount.sub(accountBalance).add(gasCost);
        console.log(
            `Funding account ${await account.getAddress()} with ${value} RBTC \nfrom funder ${await funder.getAddress()} \nwith ${await funder.getBalance(
                'pending'
            )} RBTC`
        );

        const tx = await funder.sendTransaction({
            to: await account.getAddress(),
            value
        });
        await tx.wait();
        console.log(
            `Account ${await account.getAddress()} now has ${await account.getBalance()} RBTC after funding to cover the tx cost of ${amount.toString()} RBTC and gas cost of ${gasCost} RBTC`
        );
    }
};

const ensureRollupFunds = async (amount: BigNumber, l2Wallet: RollupWallet) => {
    const l2Balance = await l2Wallet.getBalance('RBTC');
    if (amount.gt(l2Balance)) {
        await depositToSelf(l2Wallet, amount);
        console.log(
            `Deposited ${amount} RBTC to ${l2Wallet.address()} L2 account. New balance is ${await l2Wallet.getBalance(
                'RBTC'
            )} RBTC`
        );
    }
};

const getRandomElement = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

export { ensureRollupFunds, getRandomElement, ensureL1Funds };
