import {
    Transaction
} from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { PreparedTransfer, executeTransfers, generateTransfers } from '../operations/transfer';
import {
    generateL1Wallets
} from '../wallet';
import { depositToSelf } from '../operations/deposit';
import { SECOND_IN_MS, SimulationConfiguration } from './common';

const runSimulation = async ({ l1WalletGenerator, txCount, txDelay, funderL1Wallet, funderL2Wallet, numberOfAccounts, totalRunningTimeSeconds, transactionsPerSecond }:  SimulationConfiguration) => {
    // Create recepients
    console.log('Creating transfer recepients from HD wallet ...');
    const recepients = generateL1Wallets(numberOfAccounts - 1, l1WalletGenerator); // - 1 as the Funder wallet is first to be derived (TODO: ? perhaps change to numberOfAccounts to be already without Funder ?)
    console.log(`Created ${recepients.length} recipients.`);

    // Create transactions
    console.log('Creating transfers ...');

    const preparedTransfers: PreparedTransfer[] = generateTransfers(txCount, funderL2Wallet, recepients);
    console.log(`Created ${preparedTransfers.length} transfers`);

    // Verify transactions
    const totalTransferAmount = preparedTransfers.reduce((accumulator: BigNumber, transfer) => {
        accumulator.add(transfer.amount);

        return accumulator;
    }, BigNumber.from(0));
    
    if (totalTransferAmount.gt(await funderL2Wallet.getBalance(constants.AddressZero))) {
        await depositToSelf(funderL1Wallet, funderL2Wallet, totalTransferAmount);
    }

    // Execute transactions
    console.log('Executing transfers ...');

    const executedTx: Promise<Transaction>[] = await executeTransfers(preparedTransfers, funderL2Wallet, txDelay);

    // List execution results
    console.log('Resolving transactions ...');
    for (const txPromise of executedTx) {
        const tx = await txPromise;
        const receipt = await tx.awaitReceipt();
        const verification = await tx.awaitVerifyReceipt();
        console.log(
            `Transaction #${tx.txHash} ${receipt.success ? 'added' : 'failed with: ' + receipt.failReason} in block #${
                receipt.block.blockNumber
            }.`
        );
        console.log(
            `Verification of block #${verification.block.blockNumber} ${
                verification.success ? 'successfull' : 'failed with: ' + verification.failReason
            }.`
        );
    }
};

export {
    runSimulation as runTransferToNewSimulation
};

