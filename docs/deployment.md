# Deployment guide

This document covers deployment-related actions in rif-rollup. The deployment script provides multiple utilities to
prepare and deploy the different rif-rollup components.

The deployment script can take advantage of docker and reduce the amount of components to be build.

## Prerequisites

By default the rif-rollup system will use the `dev` environment configuration, to use different environment
configuration we need to compile the configuration folder with the command:

```
zk config compile testnet
```

This command looks for the folder with the same name inside the `./etc/env/`. Once the environment is compile, we can
switch to it by executing the command:

```
zk env testnet
```

### Override

To simplify the way that some of the environment variables can be updated, the override functionality was introduced.

This functioanlity consist on setting the `OVERRIDE=file_name` environment variable, that will look for the
`file_name.env` inside the `./etc/env` directory to update all the variables in the file.

### Docker compose

The deployment script use the `docker-compose.deploy.yml` to execute the different commands.

### Docker

Each of the command can use the `--docker` property that will use the `docker-compose.deploy.yml` instead of the local
environment.

## Server

To deploy the components that are needed by the `server` we need to prepare the environment, to prepare the environment
we just need to execute the command:

```
zk deploy --docker prepare-server
```

Once the environment is ready, the `server` can be deployed using the following command:

```
zk server --docker
```

## Prover

To deploy the components that are needed by the `dummy-prover` we need to prepare the environment, to prepare the
environment we just need to execute the command:

```
zk deploy --docker prepare-prover
```

To use the `dummy-prover` we need to enable it, prior enabling it, the contracts must be already deployed. During the
deployment of the contracts, a `genesis.log` file is created with the `CONTRACTS_GENESIS_ROOT` inside of it. This file
needed to execute the command:

```
zk dummy-prover --docker enable
```

Once the `dummy-prover` is enabled, it can be deployed executing the following command:

```
zk dummy-prover --docker run
```

## Dev-ticker/Dev-liquidity-token-watcher

As part of the deployment we need to deploy the `dev-ticker` and `dev-liquidity-token-watcher` by executing the
following command:

```
docker-compose -f docker-compose.deploy.yml up -d dev-ticker dev-liquidity-token-watcher
```
