import { Command } from 'commander';
import * as utils from './utils';
import * as env from './env';
import fs from 'fs';
import * as db from './db/db';
import * as deploy from './deploy';

import { ethers } from 'ethers';

export async function core(docker = false) {
    prepareForcedExitRequestAccount();

    if (docker) {
        await deploy.dockerUp('server-core');
    } else {
        await utils.spawn(
            'cargo run --bin zksync_server --release -- --components=eth-sender,witness-generator,forced-exit,prometheus,core,rejected-task-cleaner,fetchers,prometheus-periodic-metrics'
        );
    }
}

export async function web3Node(docker = false) {
    if (docker) {
        await deploy.dockerUp('server-web3');
    } else {
        await utils.spawn('cargo run --bin zksync_server --release -- --components=web3-api');
    }
}

export async function apiNode(docker = false) {
    if (docker) {
        await deploy.dockerUp('server-api');
    } else {
        await utils.spawn(
            'cargo run --bin zksync_server --release -- --components=web3-api,rest-api,rpc-api,rpc-websocket-api'
        );
    }
}

export async function server(docker = false) {
    // By the time this function is run the server is most likely not be running yet
    // However, it does not matter, since the only thing the function does is depositing
    // to the forced exit sender account, and server should be capable of recognizing
    // priority operaitons that happened before it was booted
    prepareForcedExitRequestAccount();
    if (docker) {
        await deploy.dockerUp('server');
    } else {
        await utils.spawn('cargo run --bin zksync_server --release');
    }
}

export async function genesis(docker = false) {
    await db.reset();
    await utils.confirmAction();
    if (docker) {
        await deploy.dockerRun('--rm server --genesis | tee genesis.log');
    } else {
        await utils.spawn('cargo run --bin zksync_server --release -- --genesis | tee genesis.log');
    }
    const genesisRoot = fs.readFileSync('genesis.log').toString().trim();
    const date = new Date();
    const [year, month, day, hour, minute, second] = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    ];
    const label = `${process.env.ZKSYNC_ENV}-Genesis_gen-${year}-${month}-${day}-${hour}${minute}${second}`;
    fs.mkdirSync(`logs/${label}`, { recursive: true });
    fs.copyFileSync('genesis.log', `logs/${label}/genesis.log`);
    env.modify('CONTRACTS_GENESIS_ROOT', genesisRoot);
    env.modify_contracts_toml('CONTRACTS_GENESIS_ROOT', genesisRoot);
}

// This functions deposits funds onto the forced exit sender account
// This is needed to make sure that it has the account id
async function prepareForcedExitRequestAccount() {
    console.log('Depositing to the forced exit sender account');
    const forcedExitAccount = process.env.FORCED_EXIT_REQUESTS_SENDER_ACCOUNT_ADDRESS as string;

    // This is the private key of the first test account ()
    const ethProvider = new ethers.providers.JsonRpcProvider(
        process.env.FORCED_EXIT_REQUESTS_WEB3_URL ?? process.env.ETH_CLIENT_WEB3_URL
    );
    const ethRichWallet = new ethers.Wallet(
        '0x20e4a6381bd3826a14f8da63653d94e7102b38eb5f929c7a94652f41fa7ba323',
        ethProvider
    );

    const gasPrice = await ethProvider.getGasPrice();

    const topupTransaction = await ethRichWallet.sendTransaction({
        to: forcedExitAccount,
        // The amount for deposit should be enough to send at least
        // one transaction to retrieve the funds form the forced exit smart contract
        value: ethers.utils.parseEther('100.0'),
        gasPrice
    });

    await topupTransaction.wait();

    const mainZkSyncContract = new ethers.Contract(
        process.env.CONTRACTS_CONTRACT_ADDR as string,
        await utils.readZkSyncAbi(),
        ethRichWallet
    );

    const depositTransaction = (await mainZkSyncContract.depositRBTC(forcedExitAccount, {
        // Here the amount to deposit does not really matter, as it is done purely
        // to guarantee that the account exists in the network
        value: ethers.utils.parseEther('1.0'),
        gasLimit: ethers.BigNumber.from('200000'),
        gasPrice
    })) as ethers.ContractTransaction;

    await depositTransaction.wait();

    console.log('Deposit to the forced exit sender account has been successfully completed');
}

export const command = new Command('server')
    .description('start zksync server')
    .option('--genesis', 'generate genesis data via server')
    .option('--docker', 'use docker container instead of local environment')
    .action(async (cmd: Command) => {
        const { genesis: gensisParam, docker } = cmd;
        if (gensisParam) {
            await genesis(docker);
        } else {
            await server(docker);
        }
    });

command
    .command('api')
    .description('start api node')
    .action(async (cmd: Command) => {
        const {
            parent: { docker }
        } = cmd;
        await apiNode(docker);
    });
command
    .command('web3')
    .description('start web3 node')
    .action(async (cmd: Command) => {
        const {
            parent: { docker }
        } = cmd;
        await web3Node(docker);
    });
command
    .command('core')
    .description('start core')
    .action(async (cmd: Command) => {
        const {
            parent: { docker }
        } = cmd;
        await core(docker);
    });
