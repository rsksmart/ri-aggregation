#!/bin/bash

DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:=dev}" 

zk
zk config compile $DEPLOY_ENVIRONMENT
zk env $DEPLOY_ENVIRONMENT

docker-compose -f docker-compose.deploy.yml up -d rollup
docker-compose -f docker-compose.deploy.yml exec -T rollup zk
docker-compose -f docker-compose.deploy.yml exec -T rollup zk config compile $DEPLOY_ENVIRONMENT
docker-compose -f docker-compose.deploy.yml exec -T rollup zk env $DEPLOY_ENVIRONMENT
docker-compose -f docker-compose.deploy.yml exec -T rollup zk run yarn --no-sdk
docker-compose -f docker-compose.deploy.yml exec -T rollup zk run plonk-setup
docker-compose -f docker-compose.deploy.yml exec -T rollup zk run verify-keys unpack
docker-compose -f docker-compose.deploy.yml exec -T rollup zk db setup
docker-compose -f docker-compose.deploy.yml exec -T rollup zk contract build
docker-compose -f docker-compose.deploy.yml exec -T rollup zk server --genesis
docker-compose -f docker-compose.deploy.yml exec -T rollup zk contract deploy -- --deployerPrivateKey=$DEPLOYER_KEY
docker-compose -f docker-compose.deploy.yml exec -T rollup zk db insert contract
# FIXME: We need validate if we can publish the contracts
# docker-compose -f docker-compose.deploy.yml exec -T rollup zk contract publish 

