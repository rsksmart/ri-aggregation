import { RootstockOperation, Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { PreparedDeposit, executeDeposits, generateDeposits, resolveDeposits } from '../operations/deposit';
import config from '../utils/config.utils';
import { generateWallets } from '../utils/wallet.utils';
import { SimulationConfiguration } from './setup';
import { ensureL1Funds } from '../operations/common';

const runSimulation = async ({ walletGenerator, funderL2Wallet, txCount, txDelay }: SimulationConfiguration) => {
    console.time('total time');
    const { numberOfAccounts } = config;
    console.log('Creating deposit users from HD wallet ...');
    console.time('users');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);
    console.timeEnd('users');
    console.log(`Created ${users.length} users.`);

    console.log(`Creating ${txCount} deposits ...`);
    console.time('tx preparation');
    const preparedDeposits: PreparedDeposit[] = generateDeposits(txCount, [funderL2Wallet, ...users]);
    console.timeEnd('tx preparation');
    console.log(`Created ${preparedDeposits.length} deposits`);

    const { _ethSigner: l1signer } = funderL2Wallet;

    // Verify transactions
    type SenderOutgoings = Map<RollupWallet, BigNumber>;
    type ReducedSenderOutgoings = {
        senderToOutgoings: SenderOutgoings;
        totalOutgoings: BigNumber;
    };
    console.time('collect amounts');
    const { senderToOutgoings, totalOutgoings } = preparedDeposits.reduce<ReducedSenderOutgoings>(
        ({ senderToOutgoings, totalOutgoings }, { from, amount }) => ({
            senderToOutgoings: new Map([
                ...senderToOutgoings,
                [from, amount.add(senderToOutgoings.get(from) || constants.Zero)]
            ]),
            totalOutgoings: totalOutgoings.add(amount)
        }),
        {
            senderToOutgoings: new Map<RollupWallet, BigNumber>(),
            totalOutgoings: constants.Zero
        }
    );
    console.timeEnd('collect amounts');
    console.time('funding');
    const funderL1Balance = await l1signer.getBalance('pending');
    if (totalOutgoings.gt(funderL1Balance)) {
        throw new Error(
            `Insufficient funds on funder account. Required: ${totalOutgoings.toString()}, available: ${funderL1Balance}`
        );
    }
    const ensureAccountFunds = ensureL1Funds(l1signer);
    for (const [sender, amount] of senderToOutgoings.entries()) {
        await ensureAccountFunds(amount, sender._ethSigner);
    }
    console.timeEnd('funding');

    // Execute transactions
    console.time('execution');
    const executedTx: RootstockOperation[] = await Promise.all(
        (await executeDeposits(preparedDeposits, txDelay)).map(async (tx) => await tx)
    );
    console.timeEnd('execution');

    // // List execution results

    console.time('resolution');
    await resolveDeposits(executedTx);
    console.timeEnd('resolution');
    console.timeEnd('total time');
};

export { runSimulation as runDepositSimulation };
