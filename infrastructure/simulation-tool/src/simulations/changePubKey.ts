import { constants } from 'ethers';
import {
    PreparedPubKeyChange,
    executePubKeyChanges,
    generatePubKeyChanges,
    resolvePubKeyChanges
} from '../operations/changePubKey';
import { SimulationConfiguration } from './setup';
import { Transaction } from '@rsksmart/rif-rollup-js-sdk';

const runSimulation = async ({ txCount, walletGenerator, funderL2Wallet, txDelay }: SimulationConfiguration) => {
    // prepare pubKeyChanges
    console.log(`Preparing ${txCount} ChangePubKey transactions ...`);
    const preparedPubKeyChanges: PreparedPubKeyChange[] = await generatePubKeyChanges(txCount, walletGenerator);

    // ensure that all accounts are created on L2 and that they have sufficient balance
    console.log('Ensuring that all accounts are created on L2 and that they have sufficient balance ...');
    for (const [i, pubKeyChange] of preparedPubKeyChanges.entries()) {
        process.stdout.write(`${i},`);
        const { from, ethAuthType, feeToken } = pubKeyChange;
        const accountId = await from.getAccountId();
        const feeType = {
            ChangePubKey: ethAuthType
        };
        const { totalFee: expectedFee } = await from.provider.getTransactionFee(feeType, from.address(), feeToken);
        const balance = await from.getBalance(feeToken);

        if (!accountId || balance.lt(expectedFee)) {
            const tx = await funderL2Wallet.syncTransfer({
                token: constants.AddressZero,
                amount: expectedFee,
                to: from.address()
            });
            await tx.awaitReceipt();
        }
    }

    // execute pubKeyChanges

    const executedTx: Transaction[] = await Promise.all(await executePubKeyChanges(preparedPubKeyChanges, txDelay));

    // list execution results
    const receipts = await resolvePubKeyChanges(executedTx);
    console.log('ChangePubKey simulation results:');
    console.log(receipts);
};

export { runSimulation as runChangePubKeySimulation };
