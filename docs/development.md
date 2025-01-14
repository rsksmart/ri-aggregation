# Development guide

This document covers development-related actions in ri-aggregation.

## Initializing the project

To setup the main toolkit, `zk`, simply run:

```
zk
```

You may also configure autocompletion for your shell via:

```
zk completion install
```

Once all the dependencies are installed, the project can be initialized through:

```
zk init
```

This command will do the following:

- Generate `$ZKSYNC_HOME/etc/env/dev.env` file with settings for the applications.
- Initialize docker containers with `RSKj` node and `postgres` database for local development.
- Download and unpack files for cryptographical backend (`circuit`).
- Generate required smart contracts.
- Compile all the smart contracts.
- Deploy smart contracts to the local Rootstock network.
- Initialize database and apply migrations.
- Insert required data into created database.
- Create “genesis block” for server.

Initializing may take pretty long, but many steps (such as downloading & unpacking keys and initializing containers) are
required to be done only once.

Usually, it is a good idea to do `zk init` once after each merge to the `dev` branch (as application setup may change).

**Note:** If after getting new functionality from the `dev` branch your code stopped working and `zk init` doesn't help,
you may try removing `$ZKSYNC_HOME/etc/env/dev.env` and running `zk init` once again. This may help if the application
configuration has changed.

If you don't need all of the `zk init` functionality, but just need to start/stop containers, use the following
commands:

```
zk up   # Set up `geth` and `postgres` containers
zk down # Shut down `geth` and `postgres` containers
```

## Committing changes

`zksync` uses pre-commit and pre-push git hooks for basic code integrity checks. Hooks are set up automatically within
the workspace initialization process. These hooks will not allow to commit the code which does not pass several checks.

Currently the following criteria are checked:

- Rust code should always be formatted via `cargo fmt`.
- Other code should always be formatted via `zk fmt`.
- Dummy Prover should not be staged for commit (see below for the explanation).

## Using Dummy Prover

Using the real prover for the development can be not really handy, since it’s pretty slow and resource consuming.

Instead, one may want to use the Dummy Prover: lightweight version of the prover, which does not actually prove
anything, but acts as it does.

To enable the dummy prover run:

```
zk dummy-prover enable
```

And after that you will be able to use the dummy prover instead of actual prover:

```
zk dummy-prover run # Instead of `zk prover`
```

**Warning:** `dummy-prover enable` subcommand changes the `Verifier.sol` contract, which is a part of `git` repository.
Be sure not to commit these changes when using the dummy prover!

If one will need to switch back to the real prover, the following command is required:

```
zk dummy-prover disable
```

This command will revert changes in the contract and redeploy it, so the actual prover will be usable again.

Also you can always check the current status of the dummy verifier:

```
$ zk dummy-prover status
Dummy Prover status: disabled
```

## Database migrations

zkSync uses PostgreSQL as a database backend, and `diesel-cli` for database migrations management.

Existing migrations are located in `core/lib/storage/migrations`.

Adding a new migration requires the following actions:

1. Go to the `storage` folder:

   ```
   cd core/lib/storage
   ```

2. Generate a blanket migration:

   ```
   diesel migration generate name-of-your-migration
   ```

3. Implement migration: `up.sql` must contain new changes for the DB, and `down.sql` must revert the migration and
   return the database into previous state.
4. Run `zk db migrate` to apply migration.
5. Implement corresponding changes in the `storage` crate.
6. Implement tests for new functionality.
7. Run database tests:

```
zk test db
```

## Testing

- Running the `rust` unit-tests (heavy tests such as ones for `circuit` and database will not be run):

  ```
  zk f cargo test
  ```

- Running the database tests:

  ```
  zk test db
  ```

- Running the integration test:

  ```
  zk server           # Has to be run in the 1st terminal
  zk dummy-prover run # Has to be run in the 2nd terminal
  zk test i server    # Has to be run in the 3rd terminal
  ```

- Running the circuit tests:

  ```
  zk test circuit
  ```

- Running the prover tests:

  ```
  zk test prover
  ```

- Running the benchmarks:

  ```
  zk f cargo bench
  ```

- Running the loadtest:

  ```
  zk server # Has to be run in the 1st terminal
  zk prover # Has to be run in the 2nd terminal
  zk run loadtest # Has to be run in the 3rd terminal
  ```

  **Note**. If you have compilation issues with `sqlx`, then make sure to run `zk up` before running the tests. Also, if
  you see some tests fail, you might need to call `zk db reset` and restart the tests.

### Code coverage

**Note**. Code coverage measurement requires `grcov` and `llvm-tools-preview` to be installed.

```bash
cargo install grcov
rustup component add llvm-tools-preview
```

To measure code coverage of unit tests, just set the environment variable `CODE_COVERAGE` to `true` or `1`.

```bash
CODE_COVERAGE=true zk test prover
```

Code coverage is measured using the following tests:

- `zk test witness-generator`
- `zk test server-rust`
- `zk test crypto-rust --no-circuit`

Reports can be generated using [grcov](https://github.com/mozilla/grcov):

```bash
grcov . --binary-path ./target/release/deps/ -s . -t html --branch --ignore-not-existing --ignore '../*' --ignore "/*" -o target/release/coverage/html
```

## Developing circuit

- To generate proofs one must have the universal setup files (which are downloaded during the first initialization).
- To verify generated proofs one must have verification keys. Verification keys are generated for the specific circuit
  `Verifier.sol` contract; without these keys it is impossible to verify proofs on the Rootstock network.

Steps to do after updating circuit:

1. Update circuit version by updating `KEY_DIR` in your env file (don’t forget to place it to `dev.env.example`) (last
   parts of this variable usually mean last commit where you updated circuit).
2. Regenerate verification keys and Verifier contract using `zk run verify-keys gen` command.
3. Pack generated verification keys using `zk run verify-keys pack` command and commit the resulting file to the repo.

## Build and push Docker images to dockerhub

```
zk docker push <IMAGE>
```

## Contracts

### Re-build contracts

```
zk contract build
```

### Publish source code on Etherscan

```
zk contract publish
```
