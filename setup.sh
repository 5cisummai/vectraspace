#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/app"
EMBED_DIR="$ROOT_DIR/embedding-host"
EMBED_VENV_DIR="$EMBED_DIR/.venv"

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: required command '$1' not found in PATH."
		exit 1
	fi
}

echo "[setup] Validating required tools..."
need_cmd python3.11
need_cmd pnpm

if [[ ! -f "$APP_DIR/package.json" ]]; then
	echo "Error: app package.json not found at $APP_DIR"
	exit 1
fi

if [[ ! -f "$EMBED_DIR/requirements.txt" ]]; then
	echo "Error: embedding host requirements.txt not found at $EMBED_DIR"
	exit 1
fi

echo "[setup] Installing Node dependencies in app/..."
cd "$APP_DIR"
pnpm install

echo "[setup] Building app/..."
pnpm build

echo "[setup] Creating/updating Python venv in embedding-host/..."
cd "$EMBED_DIR"
if [[ -d "$EMBED_VENV_DIR" ]]; then
	venv_version="$($EMBED_VENV_DIR/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
	if [[ "$venv_version" != "3.11" ]]; then
		echo "[setup] Existing venv uses Python ${venv_version:-unknown}; recreating with Python 3.11..."
		rm -rf "$EMBED_VENV_DIR"
	fi
fi

if [[ ! -d "$EMBED_VENV_DIR" ]]; then
	python3.11 -m venv "$EMBED_VENV_DIR"
fi

# shellcheck disable=SC1091
source "$EMBED_VENV_DIR/bin/activate"
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m py_compile app.py

echo "[setup] Done."
echo "[setup] Next: run './run.sh' from $ROOT_DIR"
