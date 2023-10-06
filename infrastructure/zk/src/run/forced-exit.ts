import { Command } from 'commander';
import fetch from 'node-fetch';
import * as utils from '../utils';
import { BigNumber, BigNumberish, ethers } from 'ethers';

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

async function checkForcedExitSenderAccountBalance(nodeUrl: string, nodeType: 'REST' | 'JSONRPC') {
    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;
    let state: State | undefined;
    if (nodeType === 'REST') {
        ({ finalized: state } = await processRestRequest(nodeUrl, forcedExitAccount));
    } else {
        ({ verified: state } = await processJsonRpcRequest(nodeUrl, forcedExitAccount));
    }

    if (!state || state.pubKeyHash === 'sync:0000000000000000000000000000000000000000') {
        if (state?.balances['RBTC']) {
            const balance = BigNumber.from(state.balances['RBTC']);
            if (!balance.isZero()) {
                console.log(`Forced exit sender account balance is ${balance.toString()} RBTC`);
                console.log('Wait until the preparation of the forced exit sender account is completed');
            }
        }
        console.log('Forced exit sender account balance is not ready');
        return;
    }

    console.log('Forced exit sender account balance is ready');
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

async function depositToForcedExitSenderAccount(
    l1Address: string,
    privateKey: string,
    amount: string,
    mnemonic: boolean
) {
    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.FORCED_EXIT_REQUESTS_WEB3_URL ?? process.env.ETH_CLIENT_WEB3_URL
    );
    const wallet = mnemonic
        ? ethers.Wallet.fromMnemonic(privateKey).connect(provider)
        : new ethers.Wallet(privateKey).connect(provider);

    if (l1Address.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log('L1 address does not match the provided private key or mnemonic');
        return;
    }

    const mainZkSyncContract = new ethers.Contract(
        process.env.CONTRACTS_CONTRACT_ADDR as string,
        await utils.readZkSyncAbi(),
        wallet
    );

    const depositTransaction = (await mainZkSyncContract.depositRBTC(forcedExitAccount, {
        value: ethers.utils.parseEther(amount)
    })) as ethers.ContractTransaction;

    await depositTransaction.wait();

    console.log('Deposit to the forced exit sender account has been successfully completed');
}

export const command = new Command('forced-exit').description('prepare forced exit sender account');

command
    .command('check')
    .description('check forced exit sender account balance')
    .arguments('<nodeUrl> <nodeType>')
    .action(async (nodeUrl: string, nodeType: string) => {
        if (nodeType !== 'REST' && nodeType !== 'JSONRPC') {
            console.log('Node type must be either REST or JSONRPC');
            return;
        }
        await checkForcedExitSenderAccountBalance(nodeUrl, nodeType);
    });

command
    .command('prepare')
    .description('deposit to forced exit sender account')
    .arguments('<l1Address> <privateKey> [amount]')
    .option('-m --mnemonic', 'Is mnemonic')
    .action(async (l1Address: string, privateKey: string, amount = '0.0001', cmd: Command) => {
        const { mnemonic } = cmd;
        await depositToForcedExitSenderAccount(l1Address, privateKey, amount, !!mnemonic);
    });
