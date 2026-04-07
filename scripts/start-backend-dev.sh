#!/bin/sh

set -eu

APP_DIR="/app"
LOCK_FILE="$APP_DIR/package-lock.json"
HASH_FILE="$APP_DIR/node_modules/.package-lock.hash"

mkdir -p "$APP_DIR/node_modules"

current_hash=""
saved_hash=""

if [ -f "$LOCK_FILE" ]; then
  current_hash="$(sha256sum "$LOCK_FILE" | awk '{ print $1 }')"
fi

if [ -f "$HASH_FILE" ]; then
  saved_hash="$(cat "$HASH_FILE")"
fi

should_install="false"

if [ ! -d "$APP_DIR/node_modules/@nestjs" ]; then
  should_install="true"
fi

if [ -n "$current_hash" ] && [ "$current_hash" != "$saved_hash" ]; then
  should_install="true"
fi

if [ "$should_install" = "true" ]; then
  echo "检测到依赖需要同步，开始执行 npm ci..."
  npm ci

  if [ -n "$current_hash" ]; then
    echo "$current_hash" > "$HASH_FILE"
  fi
else
  echo "依赖已同步，直接启动后端开发服务。"
fi

exec npm run start:dev
