import { Command } from 'commander';
import * as utils from '../utils';

import * as integration from './integration';
export { integration };

const CODE_COVERAGE_FLAGS = `CARGO_INCREMENTAL=0 RUSTFLAGS='-C instrument-coverage' LLVM_PROFILE_FILE='cargo-test-%p-%m.profraw'`;
const IS_CODE_COVERAGE_ENABLED = process.env.CODE_COVERAGE === 'true' || process.env.CODE_COVERAGE === '1';
const CARGO_FLAGS = IS_CODE_COVERAGE_ENABLED ? CODE_COVERAGE_FLAGS : '';

async function runOnTestDb(reset: boolean, dir: string, command: string) {
    const databaseUrl = process.env.DATABASE_URL as string;
    process.env.DATABASE_URL = databaseUrl.replace(/plasma/g, 'plasma_test');
    process.chdir('core/lib/storage');
    if (reset) {
        console.info('Performing database reset...');
        await utils.exec('diesel database reset');
        await utils.exec('diesel migration run');
    }
    process.chdir(process.env.ZKSYNC_HOME as string);

    process.chdir(dir);
    await utils.spawn(command);
    process.chdir(process.env.ZKSYNC_HOME as string);
}

export async function db(reset: boolean, ...args: string[]) {
    // Running many similar transactions in parallel can cause db deadlocks, so we run
    // them in a single thread. Given that tests are pretty fast, it's not a big problem.
    await runOnTestDb(
        reset,
        'core/lib/storage',
        `${CARGO_FLAGS} cargo test --release -p zksync_storage --lib -- --ignored --nocapture --test-threads=1 
        ${args.join(' ')}`
    );
}

export async function rustApi(reset: boolean, ...args: string[]) {
    // Running many similar transactions in parallel can cause db deadlocks, so we run
    // them in a single thread. Given that tests are pretty fast, it's not a big problem.
    await runOnTestDb(
        reset,
        'core/bin/zksync_api',
        `${CARGO_FLAGS} cargo test --release -p zksync_api --lib -- --ignored --nocapture --test-threads=1 api_server
        ${args.join(' ')}`
    );
}

export async function contracts() {
    await utils.spawn('yarn contracts test');
}

export async function circuit(threads: number = 1, testName?: string, ...args: string[]) {
    await utils.spawn(
        `${CARGO_FLAGS} cargo test --no-fail-fast --release -p zksync_circuit ${testName || ''}
         -- --ignored --test-threads ${threads} ${args.join(' ')}`
    );
}

export async function prover() {
    await utils.spawn(`${CARGO_FLAGS} cargo test -p zksync_prover --release`);
}

export async function witness_generator() {
    await utils.spawn(`${CARGO_FLAGS} cargo test -p zksync_witness_generator --release`);
}

export async function js() {
    await utils.spawn('yarn zksync tests');
}

async function rustCryptoTests() {
    process.chdir('sdk/zksync-crypto');
    await utils.spawn(`${CARGO_FLAGS} cargo test --release`);
    process.chdir(process.env.ZKSYNC_HOME as string);
}

export async function serverRust() {
    await utils.spawn(`${CARGO_FLAGS} cargo test --release -- --test-threads=1`);
    await db(true);
    await rustApi(true);
    await prover();
}

export async function cryptoRust(runCircuit = true) {
    if (runCircuit) {
        await circuit(25);
    }
    await rustCryptoTests();
}

export async function rust() {
    await serverRust();
    await cryptoRust();
}

export async function walletGenerator() {
    process.chdir('core/lib/wallet_creator');
    await utils.spawn('cargo test');
}

export const command = new Command('test').description('run test suites').addCommand(integration.command);

command.command('js').description('run unit-tests for javascript packages').action(js);
command.command('prover').description('run unit-tests for the prover').action(prover);
command.command('witness-generator').description('run unit-tests for the witness-generator').action(witness_generator);
command.command('contracts').description('run unit-tests for the contracts').action(contracts);
command.command('rust').description('run unit-tests for all rust binaries and libraries').action(rust);
command.command('server-rust').description('run unit-tests for server binaries and libraries').action(serverRust);
command
    .command('crypto-rust')
    .description('run unit-tests for rust crypto binaries and libraries')
    .option('--no-circuit', 'do not run the circuit tests')
    .action(async (cmd: Command) => {
        await cryptoRust(cmd.circuit);
    });
command
    .command('wallet-generator')
    .description('run unit-tests for the wallet-generator library')
    .action(walletGenerator);

command
    .command('db')
    .description('run unit-tests for the database')
    .option('--no-reset', 'do not reset the database before test starting')
    .allowUnknownOption()
    .action(async (cmd: Command, options: string[] | undefined) => {
        await db(cmd.reset, ...(options || []));
    });

command
    .command('rust-api')
    .description('run unit-tests for the REST API')
    .option('--no-reset', 'do not reset the database before test starting')
    .allowUnknownOption()
    .action(async (cmd: Command, options: string[] | undefined) => {
        await rustApi(cmd.reset, ...(options || []));
    });

command
    .command('circuit [threads] [test_name] [options...]')
    .description('run unit-tests for the circuit')
    .allowUnknownOption()
    .action(async (threads: number | null, testName: string | null, options: string[]) => {
        await circuit(threads || 1, testName || '', ...options);
    });

command
    .command('simulator')
    .aliases(['s', 'sim', 'simul', 'simulate', 'simulation', 'simulations', 'simulation-tool'])
    .description('run the simulator unit tests')
    .action(async () => {
        await utils.spawn('zk simulator test');
    });
