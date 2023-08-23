import { Command } from 'commander';
import * as utils from './utils';

export const simulator = new Command('simulator')
    .aliases(['s', 'sim', 'simul', 'simulate', 'simulation', 'simulations', 'simulation-tool'])
    .description('Open up a dedicated TUI for running transaction simulations on Rollup')
    .action(async (_cmd: Command) => {
        await utils.spawn('yarn run simulation-tool simulate');
    });

simulator
    .command('build')
    .alias('b')
    .description('Build the simulator prior to execution')
    .action(async () => {
        await utils.spawn('yarn build:simulation-tool');
    });

simulator
    .command('test')
    .alias('t')
    .description(`Run the simulation tool's unit tests`)
    .option('-w --watch', 'Watch for changes and re-run tests')
    .action(async ({ watch }) => {
        await utils.spawn(`yarn simulation-tool test${watch ? ':watch' : ''} `);
    });
