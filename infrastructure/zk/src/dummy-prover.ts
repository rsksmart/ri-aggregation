import { Command } from 'commander';
import * as utils from './utils';

import * as server from './server';
import * as contract from './contract';
import * as env from './env';
import * as docker from './docker';

async function performRedeployment(withDocker = false) {
    await contract.build();
    await server.genesis(withDocker);
    await contract.redeploy();
}

export async function run(withDocker = false) {
    if (withDocker) {
        await docker.deployUp('prover');
        return;
    }

    await utils.spawn('cargo run --release --bin dummy_prover dummy-prover-instance');
}

export async function status() {
    if (process.env.CONTRACTS_TEST_DUMMY_VERIFIER == 'true') {
        console.log('Dummy Prover status: enabled');
        return true;
    }
    console.log('Dummy Prover status: disabled');
    return false;
}

async function setStatus(value: boolean, redeploy: boolean, withDocker: boolean) {
    env.modify('CONTRACTS_TEST_DUMMY_VERIFIER', `CONTRACTS_TEST_DUMMY_VERIFIER="${value}"`);
    env.modify_contracts_toml('CONTRACTS_TEST_DUMMY_VERIFIER', `CONTRACTS_TEST_DUMMY_VERIFIER="${value}"`);
    if (withDocker) {
        env.modify('MISC_DOCKER_DUMMY_PROVER', `MISC_DOCKER_DUMMY_PROVER=${value}`);
        env.modify_contracts_toml('MISC_DOCKER_DUMMY_PROVER', `MISC_DOCKER_DUMMY_PROVER=${value}`);
    }
    await status();
    if (redeploy) {
        console.log('Redeploying the contract...');
        await performRedeployment(withDocker);
        console.log('Done.');
    }
}

export async function enable(redeploy = true, withDocker = false) {
    await setStatus(true, redeploy, withDocker);
}

export async function disable(redeploy = true, withDocker = false) {
    await setStatus(false, redeploy, withDocker);
}

export const command = new Command('dummy-prover')
    .option('--with-docker', 'use a docker container instead of local environment')
    .description('commands for zksync dummy prover');

command
    .command('run')
    .description('launch the dummy prover')
    .action(async (cmd: Command) => {
        const {
            parent: { withDocker }
        } = cmd;
        await run(withDocker);
    });

command
    .command('enable')
    .description('enable the dummy prover')
    .option('--no-redeploy', 'do not redeploy the contracts')
    .action(async (cmd: Command) => {
        const {
            redeploy,
            parent: { withDocker }
        } = cmd;
        await enable(!!redeploy, withDocker);
    });

command
    .command('disable')
    .description('disable the dummy prover')
    .option('--no-redeploy', 'do not redeploy the contracts')
    .action(async (cmd: Command) => {
        const {
            redeploy,
            parent: { withDocker }
        } = cmd;
        await disable(!!redeploy, withDocker);
    });

command
    .command('status')
    .description('check if dummy prover is enabled')
    // @ts-ignore
    .action(status);
