#!/bin/bash

cp -f docker/rskj/from_source/* docker/rskj/
mkdir -p volumes/rskj
mkdir -p volumes/postgres
mkdir -p volumes/tesseracts

# docker build -f ./Dockerfile -t runner --progress plain --force-rm --no-cache=true  . && \
# docker run -v zksync:/zksync runner
docker compose up  --remove-orphans -d
