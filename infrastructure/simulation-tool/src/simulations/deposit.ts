import { RootstockOperation, Wallet as RollupWallet } from '@rsksmart/rif-rollup-js-sdk';
import { BigNumber, constants } from 'ethers';
import { PreparedDeposit, executeDeposits, generateDeposits, resolveDeposits } from '../operations/deposit';
import config from '../utils/config.utils';
import { generateWallets } from '../utils/wallet.utils';
import { SimulationConfiguration } from './setup';
import { ensureL1Funds } from '../operations/common';

const runSimulation = async ({ walletGenerator, funderL2Wallet, txCount, txDelay }: SimulationConfiguration) => {
    const { numberOfAccounts } = config;
    console.log('Creating deposit users from HD wallet ...');
    const users: RollupWallet[] = await generateWallets(numberOfAccounts - 1, walletGenerator);
    console.log(`Created ${users.length} users.`);

    console.log(`Creating ${txCount} deposits ...`);
    const preparedDeposits: PreparedDeposit[] = generateDeposits(txCount, [funderL2Wallet, ...users]);
    console.log(`Created ${preparedDeposits.length} deposits`);

    // Verify transactions
    type SenderOutgoings = Map<RollupWallet, BigNumber>;
    type ReducedSenderOutgoings = {
        senderToOutgoings: SenderOutgoings;
        totalOutgoings: BigNumber;
    };
    const outgoingsPerSender = preparedDeposits.reduce<ReducedSenderOutgoings>(
        ({ senderToOutgoings, totalOutgoings }, { from, amount }) =>
            ({ x: console.log(`from: ${from.address()} value: ${amount.toString()}`) } && {
                senderToOutgoings: senderToOutgoings.set(
                    from,
                    amount.add(senderToOutgoings.get(from) || constants.Zero)
                ),
                totalOutgoings: totalOutgoings.add(amount)
            }),
        {
            senderToOutgoings: new Map<RollupWallet, BigNumber>(),
            totalOutgoings: constants.Zero
        }
    );

    if (outgoingsPerSender.totalOutgoings.gt(await funderL2Wallet._ethSigner.getBalance())) {
        throw new Error(
            `Insufficient funds on funder account. Required: ${outgoingsPerSender.totalOutgoings.toString()}, available: ${await funderL2Wallet._ethSigner.getBalance()}`
        );
    }
    const ensureAccountFunds = ensureL1Funds(funderL2Wallet._ethSigner);
    for (const [sender, amount] of outgoingsPerSender.senderToOutgoings.entries()) {
        await ensureAccountFunds(amount, sender._ethSigner);
    }

    // Execute transactions
    const executedTx: RootstockOperation[] = await Promise.all(
        (await executeDeposits(preparedDeposits, txDelay)).map((tx) => tx)
    );

    // // List execution results
    await resolveDeposits(executedTx);
};

export { runSimulation as runDepositSimulation };
