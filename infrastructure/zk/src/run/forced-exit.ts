import { Command } from 'commander';
import fetch from 'node-fetch';
import { BigNumber, BigNumberish, ethers } from 'ethers';
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
    amount: string,
    nodeUrl: string,
    nodeType: string
): Promise<void> {
    if (await isForcedExitSenderAccountReady(nodeUrl, nodeType)) {
        return;
    }

    await depositToForcedExitSenderAccount(l1Address, privateKey, amount);
}

export async function depositToForcedExitSenderAccount(l1Address: string, privateKey: string, amount: string) {
    console.log('Depositing to the forced exit sender account sender');

    const provider = new ethers.providers.JsonRpcProvider(
        process.env.FORCED_EXIT_REQUESTS_WEB3_URL ?? process.env.ETH_CLIENT_WEB3_URL
    );
    const wallet = new ethers.Wallet(privateKey, provider);

    if (l1Address.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log('L1 address does not match the provided private key');
        return;
    }

    const mainZkSyncContract = new ethers.Contract(
        process.env.CONTRACTS_CONTRACT_ADDR as string,
        await utils.readZkSyncAbi(),
        wallet
    );

    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;
    const depositTransaction = (await mainZkSyncContract.depositRBTC(forcedExitAccount, {
        value: ethers.utils.parseEther(amount)
    })) as ethers.ContractTransaction;

    console.log(`Deposit transaction hash: ${depositTransaction.hash}`);

    await depositTransaction.wait();

    console.log('Deposit to the forced exit sender account has been successfully completed');
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
    .arguments('<l1Address>')
    .arguments('<privateKey>')
    .arguments('[amount]')
    .action(async (l1Address: string, privateKey: string, amount = '0.0001', cmd: Command) => {
        const {
            parent: { nodeUrl, nodeType }
        } = cmd;
        await prepareForcedExitSenderAccount(l1Address, privateKey, amount, nodeUrl, nodeType);
    });
