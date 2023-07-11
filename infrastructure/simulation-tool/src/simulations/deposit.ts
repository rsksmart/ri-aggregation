import { PreparedDeposit, generateDeposits } from '../operations/deposit';
import {
    generateL1Wallets
} from '../wallet';
import { SimulationConfiguration } from './common';

const runSimulation = async ({ l1WalletGenerator, , numberOfAccounts, totalRunningTimeSeconds, transactionsPerSecond }: SimulationConfiguration) => {
    console.log('Creating transfer recepients from HD wallet ...');
    const recepients = generateL1Wallets(numberOfAccounts - 1, l1WalletGenerator);
    console.log(`Created ${recepients.length} recipients.`);

    // Create transactions
    console.log('Creating deposits ...');
    const txCount = totalRunningTimeSeconds * transactionsPerSecond;

    const preparedTransfers: PreparedDeposit[] = generateDeposits(txCount, funderL2Wallet, recepients);
    console.log(`Created ${preparedTransfers.length} transfers`);

};

export {
    runSimulation as runDepositSimulation
};

