import { Command } from 'commander';
import fetch from 'node-fetch';
import { BigNumber, BigNumberish, ethers, providers } from 'ethers';
import * as utils from '../utils';

type State = {
    balances: {
        [token: string]: BigNumberish;
    };
    nonce: number;
    pubKeyHash: string;
};

type RestAccountState = {
    finalized: State | undefined;
};

type RpcAccountState = {
    verified: State;
};

const SYNC = 'sync:0000000000000000000000000000000000000000';

async function isForcedExitSenderAccountReady(nodeUrl: string, nodeType: string): Promise<boolean> {
    if (nodeType !== 'REST' && nodeType !== 'JSONRPC') {
        console.log('Node type must be either REST or JSONRPC');
        return false;
    }

    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;
    const state =
        nodeType === 'REST'
            ? (await processRestRequest(nodeUrl, forcedExitAccount)).finalized
            : (await processJsonRpcRequest(nodeUrl, forcedExitAccount)).verified;

    if (state?.pubKeyHash !== SYNC) {
        console.log('Forced exit sender account is ready');
        return true;
    }

    if (state?.balances['RBTC']) {
        const balance = BigNumber.from(state.balances['RBTC']);
        if (!balance.isZero()) {
            console.log(`Forced exit sender account balance is ${balance.toString()} RBTC`);
            console.log('Wait until the preparation of the forced exit sender account is completed');
            return true;
        }
    }

    console.log('Forced exit sender account is not ready');
    return false;
}

async function processRestRequest(nodeUrl: string, forcedExitAccount: string): Promise<RestAccountState> {
    const response = await fetch(`${nodeUrl}/accounts/${forcedExitAccount}`);
    const { result } = await response.json();

    return result;
}

async function processJsonRpcRequest(nodeUrl: string, forcedExitAccount: string): Promise<RpcAccountState> {
    const body = {
        jsonrpc: '2.0',
        method: 'account_info',
        params: [forcedExitAccount],
        id: 1
    };
    const response = await fetch(nodeUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            Accept: 'application/json',
            'Content-type': 'application/json'
        }
    });
    const { result } = await response.json();

    return result;
}

async function prepareForcedExitSenderAccount(
    l1Address: string,
    privateKey: string,
    amount: string | undefined,
    nodeUrl: string,
    nodeType: string
): Promise<void> {
    if (await isForcedExitSenderAccountReady(nodeUrl, nodeType)) {
        return;
    }

    await depositToForcedExitSenderAccount(l1Address, privateKey, amount);
}

export async function depositToForcedExitSenderAccount(l1Address?: string, privateKey?: string, amount = '0.0001') {
    console.log('Depositing to the forced exit sender account sender');

    const parsedAmount = ethers.utils.parseEther(amount);

    const signer = await retrieveSigner(parsedAmount, l1Address, privateKey);

    if (!signer) {
        console.log('Must provide an L1 address and L1 private key that matches');
        return;
    }

    const mainZkSyncContract = new ethers.Contract(
        process.env.CONTRACTS_CONTRACT_ADDR as string,
        await utils.readZkSyncAbi(),
        signer
    );

    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;
    const gasPrice = await signer.getGasPrice();
    const depositTransaction = (await mainZkSyncContract.depositRBTC(forcedExitAccount, {
        value: parsedAmount,
        gasPrice
    })) as ethers.ContractTransaction;

    console.log(`Deposit transaction hash: ${depositTransaction.hash}`);

    await depositTransaction.wait();

    console.log('Deposit to the forced exit sender account has been successfully completed');
}

async function retrieveSigner(
    amount: BigNumberish,
    l1Address?: string,
    privateKey?: string
): Promise<ethers.Signer | undefined> {
    const provider = new providers.JsonRpcProvider(
        process.env.FORCED_EXIT_REQUESTS_WEB3_URL ?? process.env.ETH_CLIENT_WEB3_URL
    );

    let signer: ethers.Signer | undefined;
    if (l1Address && privateKey) {
        signer = new ethers.Wallet(privateKey, provider);

        const address = await signer.getAddress();

        if (l1Address.toLowerCase() !== address.toLowerCase()) {
            console.log('L1 address does not match the provided private key');
            return undefined;
        }
    }

    if (!signer && process.env.ZKSYNC_ENV === 'dev') {
        signer = await findWealthyAccount(amount, provider);
    }

    return signer;
}

async function findWealthyAccount(
    requiredBalance: BigNumberish,
    provider: providers.JsonRpcProvider
): Promise<ethers.Signer | undefined> {
    let accounts: string[] = [];
    try {
        accounts = await provider.listAccounts();

        for (let i = accounts.length - 1; i >= 0; i--) {
            const signer = provider.getSigner(i);
            const balance = await signer.getBalance();
            if (balance.gte(requiredBalance)) {
                console.log(`Found funded account ${await signer.getAddress()}`);

                return signer;
            }
        }
    } catch (error) {
        console.log('Failed to retrieve accounts and balances:', error);
    }
    console.log(`could not find unlocked account with sufficient balance; all accounts:\n - ${accounts.join('\n - ')}`);
}

export const command = new Command('forced-exit')
    .description('prepare forced exit sender account')
    .requiredOption('-n, --nodeUrl <nodeUrl>', 'Node url')
    .requiredOption('-t, --nodeType <nodeType>', 'Node type (REST or JSONRPC)');

command
    .command('check')
    .description('check forced exit sender account balance')
    .action(async (cmd: Command) => {
        const {
            parent: { nodeUrl, nodeType }
        } = cmd;
        await isForcedExitSenderAccountReady(nodeUrl, nodeType);
    });

command
    .command('prepare')
    .description('deposit to forced exit sender account if necessary')
    .requiredOption('--address <l1Address>', 'L1 address')
    .requiredOption('-p, --privateKey <privateKey>', 'Private key of the L1 address')
    .option('--amount <amount>', 'Amount of RBTC to deposit (default: 0.0001')
    .action(async (cmd: Command) => {
        const {
            address,
            privateKey,
            amount,
            parent: { nodeUrl, nodeType }
        } = cmd;
        await prepareForcedExitSenderAccount(address, privateKey, amount, nodeUrl, nodeType);
    });
