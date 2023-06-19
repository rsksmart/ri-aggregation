import { Command } from 'commander';
import * as utils from './utils';
import * as contract from './contract';

const IMAGES = [
    'server',
    'prover',
    'nginx',
    'rskj',
    'dev-ticker',
    'keybase',
    'ci',
    'exit-tool',
    'dev-liquidity-token-watcher',
    'event-listener',
    'data-restore'
];

async function dockerCommand(command: 'push' | 'build', image: string, tag: string) {
    if (image == 'rust') {
        await dockerCommand(command, 'server', tag);
        await dockerCommand(command, 'prover', tag);
        return;
    }
    if (!IMAGES.includes(image)) {
        throw new Error(`Wrong image name: ${image}`);
    }
    if (image == 'keybase') {
        image = 'keybase-secret';
    }
    if (command == 'build') {
        await _build(image, tag);
    } else if (command == 'push') {
        await _push(image, tag);
    }
}

async function _build(image: string, tag: string) {
    if (image == 'nginx') {
        await utils.spawn('yarn explorer build');
    }
    if (image == 'server' || image == 'prover') {
        await contract.build();
    }

    const latestImage = `-t rsksmart/rollup-${image}:${tag}`;
    await utils.spawn(`DOCKER_BUILDKIT=1 docker build ${latestImage} -f ./docker/${image}/Dockerfile .`);
}

async function _push(image: string, tag: string) {
    await utils.spawn(`docker push rsksmart/${image}:${tag}`);
}

export async function build(image: string, tag: string) {
    await dockerCommand('build', image, tag);
}

export async function buildFromTag(tag: string) {
    const splitted = tag.split(':');
    await dockerCommand('build', splitted[0], splitted[1]);
}

export async function push(image: string, tag: string) {
    await dockerCommand('build', image, tag);
    await dockerCommand('push', image, tag);
}

export async function pushFromTag(tag: string) {
    const splitted = tag.split(':');
    await dockerCommand('build', splitted[0], splitted[1]);
    await dockerCommand('push', splitted[0], splitted[1]);
}

export async function restart(container: string) {
    await utils.spawn(`docker-compose restart ${container}`);
}

export async function pull() {
    await utils.spawn('docker-compose pull postgres rskj dev-liquidity-token-watcher dev-ticker tesseracts elastic');
}

export const command = new Command('docker').description('docker management');

command.command('build <image> <tag>').description('build docker image').action(build);
command.command('push <image> <tag>').description('build and push docker image').action(push);
command.command('build-from-tag <tag>').description('build docker image from tag').action(pushFromTag);
command.command('push-from-tag <tag>').description('build and push docker image from tag').action(buildFromTag);
command.command('pull').description('pull all containers').action(pull);
command.command('restart <container>').description('restart container in docker-compose.yml').action(restart);
