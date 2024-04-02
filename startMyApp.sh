#!/bin/bash
echo "---- Exporting DB Variables ----"
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="test1234"
export POSTGRES_HOST="localhost"
export POSTGRES_PORT=5432
export POSTGRES_SERVICE_HOST="localhost"
export POSTGRES_SERVICE_PORT=5432

yarn --frozen-lockfile
yarn tsc
yarn build:backend --config ../../app-config.yaml
yarn workspace backend build-image 
docker image build . -f packages/backend/Dockerfile --tag quin-backstage:1.0.0
# docker run -it -p 7007:7007 backstage