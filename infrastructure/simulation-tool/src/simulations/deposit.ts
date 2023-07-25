import config from '../utils/config.utils';
import {
    PreparedDeposit,
    depositToSelf,
    executeDeposits,
    generateDeposits,
    resolveDeposits
} from '../operations/deposit';
import { generateL1Wallets } from '../utils/wallet.utils';
import { SimulationConfiguration } from './setup';
import { BigNumber, constants } from 'ethers';
import { RootstockOperation } from '@rsksmart/rif-rollup-js-sdk';

const runSimulation = async ({
    l1WalletGenerator,
    funderL1Wallet,
    funderL2Wallet,
    txCount,
    txDelay
}: SimulationConfiguration) => {
    const { numberOfAccounts } = config;
    console.log('Creating deposit recepients from HD wallet ...');
    const recepients = generateL1Wallets(numberOfAccounts - 1, l1WalletGenerator);
    console.log(`Created ${recepients.length} recipients.`);

    const preparedDeposits: PreparedDeposit[] = generateDeposits(txCount, funderL2Wallet, recepients);
    console.log(`Created ${preparedDeposits.length} deposits`);

    // Verify transactions
    const totalDepositAmount = preparedDeposits.reduce((accumulator: BigNumber, deposit) => {
        accumulator.add(deposit.amount);

        return accumulator;
    }, BigNumber.from(0));

    if (totalDepositAmount.gt(await funderL2Wallet.getBalance(constants.AddressZero))) {
        await depositToSelf(funderL1Wallet, funderL2Wallet, totalDepositAmount);
    }

    // Execute transactions
    const executedTx: Promise<RootstockOperation>[] = await executeDeposits(preparedDeposits, txDelay);

    // List execution results
    await resolveDeposits(executedTx);
};

export { runSimulation as runDepositSimulation };
