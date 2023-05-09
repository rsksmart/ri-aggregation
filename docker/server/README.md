# How to use it

## Build

```bash
zk docker build server
```

## Run

```bash
docker run -it --rm --env-file ./etc/env/dev-docker.env -p 3000:3000 -p 3002:3002 -p 3030:3030 -p 3031:3031 matterlabs/server
```