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
    'event-listener',
    'data-restore',
    'environment'
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
    if (image == 'server' || image == 'prover') {
        await contract.build();
    }

    const imageTag = `-t rsksmart/rollup-${image}:${tag}`;
    await utils.spawn(`DOCKER_BUILDKIT=1 docker build ${imageTag} -f ./docker/${image}/Dockerfile .`);
}

async function _push(image: string, tag: string) {
    await utils.spawn(`docker push rsksmart/rollup-${image}:${tag}`);
}

export async function build(image: string, tag: string) {
    await dockerCommand('build', image, tag);
}

export async function buildFromTag(gitTag: string) {
    const { imageName, imageTag } = getNameTag(gitTag);

    await dockerCommand('build', imageName, imageTag);
}

export async function push(image: string, tag: string) {
    await dockerCommand('build', image, tag);
    await dockerCommand('push', image, tag);
}

export async function pushFromTag(gitTag: string) {
    const { imageName, imageTag } = getNameTag(gitTag);
    await dockerCommand('build', imageName, imageTag);
    await dockerCommand('push', imageName, imageTag);
}

export async function restart(container: string) {
    await utils.spawn(`docker-compose restart ${container}`);
}

export async function deployUp(service: string) {
    printDockerWarning();
    await utils.spawn(`docker-compose -f docker-compose.deploy.yml up ${service}`);
}

export async function deployRun(command: string) {
    printDockerWarning();
    await utils.spawn(`docker-compose -f docker-compose.deploy.yml run ${command}`);
}

function printDockerWarning() {
    console.log('WARNING! Using docker!');
}

export async function pull() {
    await utils.spawn('docker-compose pull postgres rskj dev-ticker tesseracts elastic');
}

function getNameTag(gitTag: string) {
    const imageName = gitTag.substring(gitTag.lastIndexOf('.') + 1);

    const imageTag = gitTag.replace(`.${imageName}`, '').substring(1);

    return {
        imageName,
        imageTag
    };
}

export const command = new Command('docker').description('docker management');

command.command('build <image> <tag>').description('build docker image').action(build);
command.command('push <image> <tag>').description('build and push docker image').action(push);
command.command('build-from-tag <gitTag>').description('build docker image from git tag').action(buildFromTag);
command.command('push-from-tag <gitTag>').description('build and push docker image from git tag').action(pushFromTag);
command.command('pull').description('pull all containers').action(pull);
command.command('restart <container>').description('restart container in docker-compose.yml').action(restart);
