#!/bin/bash

cp -f docker/rskj/from_source/* docker/rskj/
mkdir -p volumes/rskj
mkdir -p volumes/postgres
mkdir -p volumes/tesseracts

docker compose up  --remove-orphans -d
