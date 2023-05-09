# How to use it

## Build

```bash
zk docker build prover
```

## Run

```bash
docker run -it --rm --env-file ./etc/env/dev-docker.env -v ./keys/contracts-8:/keys/contracts-8 --network=host matterlabs/prover
```