import { Transaction } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { PreparedTransfer, executeTransfers, generateTransfers, resolveTransactions } from '../operations/transfer';
import { generateL1Wallets } from '../utils/wallet.utils';
import { depositToSelf } from '../operations/deposit';
import { SimulationConfiguration } from './setup';
import config from '../utils/config.utils';

const runSimulation = async ({ l1WalletGenerator, txCount, txDelay, funderL2Wallet }: SimulationConfiguration) => {
    const { numberOfAccounts } = config;
    // Create recipients
    console.log('Creating transfer recipients from HD wallet ...');
    const recipients = generateL1Wallets(numberOfAccounts - 1, l1WalletGenerator); // - 1 as the Funder wallet is first to be derived (TODO: ? perhaps change to numberOfAccounts to be already without Funder ?)
    console.log(`Created ${recipients.length} recipients.`);

    // Create transactions
    console.log('Creating transfers ...');

    const preparedTransfers: PreparedTransfer[] = generateTransfers(txCount, funderL2Wallet, recipients);
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions
    const totalTransferAmount = preparedTransfers.reduce((accumulator: BigNumber, { amount }: PreparedTransfer) => {
        accumulator.add(amount);

        return accumulator;
    }, BigNumber.from(0));

    if (totalTransferAmount.gt(await funderL2Wallet.getBalance(constants.AddressZero))) {
        await depositToSelf(funderL2Wallet, totalTransferAmount);
    }

    // Execute transactions
    const executedTx: Promise<Transaction>[] = await executeTransfers(preparedTransfers, txDelay);

    // List execution results
    await resolveTransactions(executedTx);
};

export { runSimulation as runTransferToNewSimulation };
