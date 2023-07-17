import { Command } from 'commander';
import * as utils from './utils';

import * as db from './db/db';
import * as server from './server';
import * as contract from './contract';
import * as run from './run/run';
import * as env from './env';
import * as docker from './docker';
import { up } from './up';

export async function init(sdk: boolean) {
    await utils.announced('Creating docker volumes', createVolumes());
    if (!process.env.CI) {
        await utils.announced('Pulling images', docker.pull());
        await utils.announced('Checking environment', utils.checkEnv());
        await utils.announced('Checking git hooks', env.gitHooks());
        await utils.announced('Setting up containers', up());
    }
    await utils.announced('Compiling JS packages', run.yarn(sdk));
    await utils.announced('Checking PLONK setup', run.plonkSetup());
    await utils.announced('Unpacking verification  keys', run.verifyKeys.unpack());
    await utils.announced('Setting up database', db.setup());
    await utils.announced('Building contracts', contract.build());
    await utils.announced('Deploying localhost ERC20 tokens', run.deployERC20('dev'));
    await utils.announced('Deploying localhost EIP1271 contract', run.deployEIP1271());
    await utils.announced('Deploying withdrawal helpers contracts', run.deployWithdrawalHelpersContracts());
    await utils.announced('Running server genesis setup', server.genesis());
    await utils.announced('Deploying main contracts', contract.redeploy());
    if (!process.env.CI) {
        await utils.announced('Restarting dev liquidity watcher', docker.restart('dev-ticker'));
    }
}

export async function reinit() {
    await utils.announced('Setting up containers', up());
    await utils.announced('Setting up database', db.setup());
    await utils.announced('Building contracts', contract.build());
    await utils.announced('Running server genesis setup', server.genesis(false));
    await utils.announced('Deploying main contracts', contract.redeploy());
    await utils.announced('Restarting dev liquidity watcher', docker.restart('dev-ticker'));
}

async function createVolumes() {
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/rskj');
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/postgres');
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/tesseracts');
}

export const initCommand = new Command('init')
    .description('perform zksync network initialization for development')
    .option('--no-sdk', 'not include sdk packages')
    .action(async (cmd: Command) => {
        const { sdk } = cmd;
        await init(!!sdk);
    });
export const reinitCommand = new Command('reinit')
    .description('"reinitializes" network. Runs faster than `init`, but requires `init` to be executed prior')
    .action(reinit);
