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
docker-compose -f docker-compose.deploy.yml exec -T rollup zk contract build
