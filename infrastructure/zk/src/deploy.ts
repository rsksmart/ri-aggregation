import { Command } from 'commander';

import * as db from './db/db';
import * as server from './server';
import * as contract from './contract';
import * as run from './run/run';
import * as utils from './utils';
import { announced, checkEnv } from './init';

async function prepareEnvironment() {
    await announced('Checking environment', checkEnv());
    await announced('Compiling JS packages', run.yarn(false));
}

async function prepareKeys() {
    await announced('Checking PLONK setup', run.plonkSetup());
    await announced('Unpacking verification  keys', run.verifyKeys.unpack());
}

async function prepareServer(docker: boolean) {
    await prepareEnvironment();
    await prepareKeys();
    await announced('Setting up database', db.setup());
    await announced('Building contracts', contract.build());
    await announced('Deploying localhost ERC20 tokens', run.deployERC20('dev'));
    await announced('Deploying localhost EIP1271 contract', run.deployEIP1271());
    await announced('Deploying withdrawal helpers contracts', run.deployWithdrawalHelpersContracts());
    await announced('Running server genesis setup', server.genesis(docker));
    await announced('Deploying main contracts', contract.redeploy());
}

async function prepareProver() {
    await prepareEnvironment();
    await prepareKeys();
    await announced('Building contracts', contract.build());
}

export async function dockerUp(service: string) {
    console.log('WARNING! Using docker!');
    await utils.spawn(`${getEnvironmentFiles()} docker-compose -f docker-compose.deploy.yml up ${service}`);
}

export async function dockerRun(command: string) {
    console.log('WARNING! Using docker!');
    await utils.spawn(`${getEnvironmentFiles()} docker-compose -f docker-compose.deploy.yml run ${command}`);
}

function getEnvironmentFiles() {
    const DIRECTORY = './etc/env';

    const extra = process.env.OVERRIDE ? `EXTRA_ENV_FILE=${DIRECTORY}/${process.env.OVERRIDE}.env` : '';

    return `ENV_FILE=${DIRECTORY}/${process.env.ZKSYNC_ENV}.env ${extra}`;
}

export const command = new Command('deploy')
    .option('--docker', 'use docker container instead of local environment')
    .description('commands for zksync dummy prover');

command
    .command('prepare-environment')
    .description('perform rollup environment preparation for deployment')
    .action(prepareEnvironment);
command
    .command('prepare-server')
    .description('perform rollup server preparation for deployment')
    .action(async (cmd: Command) => {
        const {
            parent: { docker }
        } = cmd;
        await prepareServer(docker);
    });
command.command('prepare-prover').description('perform rollup prover preparation for deployment').action(prepareProver);
