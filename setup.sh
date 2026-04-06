#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/app"

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: required command '$1' not found in PATH."
		exit 1
	fi
}

echo "[setup] Validating required tools..."
need_cmd docker

if [[ ! -f "$APP_DIR/.env" ]]; then
	if [[ -f "$ROOT_DIR/.env.example" ]]; then
		cp "$ROOT_DIR/.env.example" "$APP_DIR/.env"
		echo "[setup] Created .env from .env.example. Update MEDIA_ROOTS before starting the app."
	else
		echo "Error: .env.example not found at $ROOT_DIR"
		exit 1
	fi
fi

echo "[setup] Validating compose stack..."
cd "$ROOT_DIR"
docker compose config >/dev/null
docker compose build app embedding-host

echo "[setup] Done."
echo "[setup] Next: run './run.sh' from $ROOT_DIR"
