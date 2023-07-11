import { Command } from 'commander';
import * as utils from './utils';

export const start = async (_cmd: Command) => {
    await utils.spawn('yarn run simulation-tool simulate');
};

export const build = async () => {
    await utils.spawn('yarn build:simulation-tool');
};

export const setup = async () => {
    await utils.spawn('yarn build:simulation-tool configure');
};

export const command = new Command('simulate')
    .aliases(['s', 'sim', 'simul', 'tx-sim'])
    .description('Open up a dedicated TUI for running transaction simulations on Rollup')
    // .option('--seed', 'A seed to create wallets from')
    // .option('--config', 'Path to overriding configuration')
    .action(start);

command.command('setup').description('Configure the simulator interactively prior to execution').action(setup);
