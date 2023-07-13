# Deployment guide

This document covers deployment-related actions in rif-rollup. The deployment script provides multiple utilities to
prepare and deploy the different rif-rollup components.

The deployment script can take advantage of docker and reduce the amount of components to build.

## Prerequisites

By default the rif-rollup system will use the `dev` environment configuration; to use different environment
configuration we need to compile the configuration folder with the command:

```
zk config compile <env_name>
```

This command looks for the folder with the same name (`<env_name>`) inside the `./etc/env/`. Once the environment is
compiled, we can select it with the command:

```
zk env <env_name>
```

### Override

To simplify the way that some of the environment variables can be updated, the override functionality was introduced.

This functioanlity consist on setting the `OVERRIDE=<file_name>` environment variable, that will look for the
`<file_name>.env` inside the `./etc/env` directory to update all the variables in the file.

### Docker compose

The deployment script use the `docker-compose.deploy.yml` to execute the different commands.

### Docker

Each of the command can use the `--docker` property that will use the `docker-compose.deploy.yml` instead of the local
environment.

### Network

Depending on the OS that we are going to use, the network configuration may vary. For the containers to see the
localhost from the `host os`, we may need a different `host url`.

#### Linux

For `Linux` we need to use `172.17.0.1`.

#### Mac / Windows

For `Mac / Windows` we need to use `host.docker.internal`.

**Note:** The `host url (host.docker.internal)` may not be included in the `hosts` from the OS. We may need to include
in their configuration pointing to the `localhost`.

## Server

To deploy the components that are needed by the `server` we need to prepare the environment:

```
zk deploy --docker prepare-server
```

This command will do the following:

- Generate `$ZKSYNC_HOME/etc/env/dev.env` file with settings for the applications.
- Download and unpack files for cryptographical backend (`circuit`).
- Generate required smart contracts.
- Compile all the smart contracts.
- Deploy smart contracts to the local RSKj network.
- Initialize database and apply migrations.
- Insert required data into created database.
- Create “genesis block” for server.

Once the environment is ready, the `server` can be run using the following command:

```
zk server --docker
```

## Prover

To deploy the components that are needed by the `dummy-prover` we need to prepare the environment:

```
zk deploy --docker prepare-prover
```

This command will do the following:

- Generate `$ZKSYNC_HOME/etc/env/dev.env` file with settings for the applications.
- Initialize docker containers with `rskj` Ethereum node and `postgres` database for local development.
- Download and unpack files for cryptographical backend (`circuit`).
- Generate required smart contracts.

To use the `dummy-prover` we need to enable it, prior enabling it, the contracts must be already deployed. During the
contracts deployment, the `genesis.log` file is generated; this file includes the variable `CONTRACTS_GENESIS_ROOT` and
it's required for the dummy-prover to run. To enable the `dummy-prover` on docker:

```
zk dummy-prover --docker enable
```

Once the `dummy-prover` is enabled, it can be run with the following command:

```
zk dummy-prover --docker run
```

## Miscellaneous

<!-- markdownlint-disable MD029-->

We are going to deploy a local environment using the deploy script. To do it; we need to follow the next steps. All the
information necessary to understand the steps are described above:

1. Create the `dev` environment.

```
zk config compile dev
```

2. Initialize docker containers with `RSKj` node and `postgres` database for local development.

```
docker-compose -f docker-compose.deploy.yml up -d rskj postgres
```

3. Prepare the environment, the `prepare-server` also includes the `prepare-prover` preparation steps.

```
OVERRIDE=deploy zk deploy --docker prepare-server
```

4. Enable the `dummy-prover` for local development.

```
OVERRIDE=deploy zk dummy-prover --docker enable
```

5. Initialize docker containers with `dev-ticker` and `dev-liquidity-token-watcher` for local development.

```
docker-compose -f docker-compose.deploy.yml up -d dev-ticker dev-liquidity-token-watcher
```

6. Start running the `server`.

```
OVERRIDE=deploy zk server --docker
```

7. Start running the `dummy-prover`.

```
OVERRIDE=deploy zk dummy-prover --docker run
```

<!-- markdownlint-enable MD029-->
