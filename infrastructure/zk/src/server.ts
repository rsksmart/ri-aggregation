import { Command } from 'commander';
import * as utils from './utils';
import * as env from './env';
import fs from 'fs';
import * as db from './db/db';
import * as docker from './docker';
import * as forcedExit from './run/forced-exit';

export async function core(withDocker = false) {
    forcedExit.depositToForcedExitSenderAccount();
    if (withDocker) {
        await docker.deployUp('server-core');
        return;
    }

    await utils.spawn(
        'cargo run --bin zksync_server --release -- --components=eth-sender,witness-generator,forced-exit,prometheus,core,rejected-task-cleaner,fetchers,prometheus-periodic-metrics'
    );
}

export async function web3Node(withDocker = false) {
    if (withDocker) {
        await docker.deployUp('server-web3');
        return;
    }

    await utils.spawn('cargo run --bin zksync_server --release -- --components=web3-api');
}

export async function apiNode(withDocker = false) {
    if (withDocker) {
        await docker.deployUp('server-api');
        return;
    }

    await utils.spawn(
        'cargo run --bin zksync_server --release -- --components=web3-api,rest-api,rpc-api,rpc-websocket-api'
    );
}

export async function server(withDocker = false) {
    forcedExit.depositToForcedExitSenderAccount();
    if (withDocker) {
        await docker.deployUp('server');
        return;
    }

    await utils.spawn('cargo run --bin zksync_server --release');
}

export async function genesis(withDocker = false) {
    await db.reset();
    await utils.confirmAction();
    if (withDocker) {
        await docker.deployRun('--rm server --genesis | tee genesis.log');
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

export const command = new Command('server')
    .description('start zksync server')
    .option('--genesis', 'generate genesis data via server')
    .option('--with-docker', 'use a docker container instead of local environment')
    .action(async (cmd: Command) => {
        const { genesis: genesisParam, withDocker } = cmd;
        if (genesisParam) {
            await genesis(withDocker);
        } else {
            await server(withDocker);
        }
    });

command
    .command('api')
    .description('start api node')
    .action(async (cmd: Command) => {
        const {
            parent: { withDocker }
        } = cmd;
        await apiNode(withDocker);
    });

command
    .command('web3')
    .description('start web3 node')
    .action(async (cmd: Command) => {
        const {
            parent: { withDocker }
        } = cmd;
        await web3Node(withDocker);
    });
command
    .command('core')
    .description('start core')
    .action(async (cmd: Command) => {
        const {
            parent: { withDocker }
        } = cmd;
        await core(withDocker);
    });
