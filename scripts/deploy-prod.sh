#!/usr/bin/env sh

set -eu

if [ -z "${BACKEND_IMAGE:-}" ]; then
  echo "缺少环境变量 BACKEND_IMAGE"
  exit 1
fi

if [ -z "${FRONTEND_IMAGE:-}" ]; then
  echo "缺少环境变量 FRONTEND_IMAGE"
  exit 1
fi

BACKEND_TAG="${BACKEND_TAG:-latest}"
FRONTEND_TAG="${FRONTEND_TAG:-latest}"

export BACKEND_TAG FRONTEND_TAG

docker compose -f docker-compose.deploy.yml pull backend frontend nginx mongo
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
docker compose -f docker-compose.deploy.yml ps
