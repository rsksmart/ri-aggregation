import { Command } from 'commander';
import * as utils from './utils';

import * as contract from './contract';
import * as docker from './docker';
import * as env from './env';
import * as run from './run/run';
import * as server from './server';

export async function init() {
    // await createVolumes();
    if (!process.env.CI) {
        // await docker.pull();
        await checkEnv();
        await env.gitHooks();
        // await up();
    }
    // await run.yarn();
    // await run.plonkSetup();
    // await run.verifyKeys.unpack();
    // await db.setup();
    console.info(`ZK: Building contracts...`);
    await contract.build();
    console.info(`Deploying ERC20 contract...`);
    await run.deployERC20('dev');
    console.info(`Deploying EIP1271 contract...`);
    await run.deployEIP1271();
    console.info(`Deploying withdraw helpers contracts...`);
    await run.deployWithdrawalHelpersContracts();
    console.info(`Generating genesis data...`);
    await server.genesis();
    console.info(`redeploy contracts and updating addresses in the dbs...`);
    await contract.redeploy();
    if (!process.env.CI && process.env.CHAIN_ETH_NETWORK !== 'rskj') {
        console.info(`Restarting the liquidity token matcher docker container.`);
        await docker.restart('dev-liquidity-token-watcher');
    }
}

async function createVolumes() {
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/rskj');
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/postgres');
    await utils.exec('mkdir -p $ZKSYNC_HOME/volumes/tesseracts');
}

async function checkEnv() {
    const tools = ['node', 'yarn', 'cargo', 'psql', 'pg_isready', 'diesel'];
    for (const tool of tools) {
        await utils.exec(`which ${tool}`);
    }
    await utils.exec('cargo sqlx --version');
    const { stdout: version } = await utils.exec('node --version');
    // Node v14.14 is required because
    // the `fs.rmSync` function was added in v14.14.0
    if ('v14.14' >= version) {
        throw new Error('Error, node.js version 14.14.0 or higher is required');
    }
}

export const command = new Command('init-docker')
    .description('perform zksync network initialization for development in docker')
    .action(init);
