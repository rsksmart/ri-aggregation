import { Command } from 'commander';
import * as utils from './utils';

import * as server from './server';
import * as contract from './contract';
import * as env from './env';
import * as deploy from './deploy';

async function performRedeployment(docker: boolean) {
    await contract.build();
    await server.genesis(docker);
    await contract.redeploy();
}

export async function run(docker: boolean) {
    if (docker) {
        await deploy.dockerUp('prover');
    } else {
        await utils.spawn('cargo run --release --bin dummy_prover dummy-prover-instance');
    }
}

export async function status() {
    if (process.env.CONTRACTS_TEST_DUMMY_VERIFIER == 'true') {
        console.log('Dummy Prover status: enabled');
        return true;
    }
    console.log('Dummy Prover status: disabled');
    return false;
}

async function setStatus(value: boolean, redeploy: boolean, docker: boolean) {
    env.modify('CONTRACTS_TEST_DUMMY_VERIFIER', `CONTRACTS_TEST_DUMMY_VERIFIER="${value}"`);
    env.modify_contracts_toml('CONTRACTS_TEST_DUMMY_VERIFIER', `CONTRACTS_TEST_DUMMY_VERIFIER="${value}"`);
    await status();
    if (redeploy) {
        console.log('Redeploying the contract...');
        await performRedeployment(docker);
        console.log('Done.');
    }
}

export async function enable(redeploy: boolean, docker: boolean) {
    await setStatus(true, redeploy, docker);
}

export async function disable(redeploy: boolean, docker: boolean) {
    await setStatus(false, redeploy, docker);
}

export const command = new Command('dummy-prover')
    .option('--docker', 'use docker container instead of local environment')
    .description('commands for zksync dummy prover');

command
    .command('run')
    .description('launch the dummy prover')
    .action(async (cmd: Command) => {
        const {
            parent: { docker }
        } = cmd;
        await run(docker);
    });

command
    .command('enable')
    .description('enable the dummy prover')
    .option('--no-redeploy', 'do not redeploy the contracts')
    .action(async (cmd: Command) => {
        const {
            redeploy,
            parent: { docker }
        } = cmd;
        await enable(!!redeploy, docker);
    });

command
    .command('disable')
    .description('disable the dummy prover')
    .option('--no-redeploy', 'do not redeploy the contracts')
    .action(async (cmd: Command) => {
        const {
            redeploy,
            parent: { docker }
        } = cmd;
        await disable(!!redeploy, docker);
    });

command
    .command('status')
    .description('check if dummy prover is enabled')
    // @ts-ignore
    .action(status);
