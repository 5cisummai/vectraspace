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

need_cmd docker
need_cmd curl

if [[ ! -f "$APP_DIR/.env" ]]; then
	echo "Error: .env not found at $APP_DIR/.env"
	echo "Run ./setup.sh or copy .env.example to .env first."
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$APP_DIR/.env"
set +a

APP_PORT="${PORT:-3000}"

echo "[run] Starting compose services..."
cd "$ROOT_DIR"
docker compose up -d --build qdrant embedding-host app

echo "[run] Waiting for embedding host on http://127.0.0.1:8000/health ..."
for _ in {1..60}; do
	if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

if ! curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
	echo "Error: embedding host did not become ready."
	docker compose logs --tail=100 embedding-host
	exit 1
fi

echo "[run] Waiting for app on http://127.0.0.1:${APP_PORT} ..."
for _ in {1..60}; do
	if curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

if ! curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
	echo "Error: app did not become ready."
	docker compose logs --tail=100 app
	exit 1
fi

echo "[run] Ready: app http://127.0.0.1:${APP_PORT}"
echo "[run] Use 'docker compose logs -f --tail=100' to follow logs."
echo "[run] Use 'docker compose down' to stop services."
