import { constants } from 'ethers';
import {
    PreparedPubKeyChange,
    executePubKeyChanges,
    generatePubKeyChanges,
    resolvePubKeyChanges
} from '../operations/changePubKey';
import { SimulationConfiguration } from './setup';

const runSimulation = async ({ txCount, walletGenerator, funderL2Wallet, txDelay }: SimulationConfiguration) => {
    // prepare pubKeyChanges
    const preparedPubKeyChanges: PreparedPubKeyChange[] = await generatePubKeyChanges(txCount, walletGenerator);

    // ensure that all accounts are created on L2 and that they have sufficient balance
    for (const pubKeyChange of preparedPubKeyChanges) {
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
    const executedTx = await Promise.all((await executePubKeyChanges(preparedPubKeyChanges, txDelay)).map((tx) => tx));

    // list execution results
    const receipts = await resolvePubKeyChanges(executedTx);
    console.log('ChangePubKey simulation results:');
    console.log(receipts);
};

export { runSimulation as runChangePubKeySimulation };
