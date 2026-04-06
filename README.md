# Media Server Workspace

This workspace contains two parts:

- [app](app) - the SvelteKit media server UI and API
- [embedding-host](embedding-host) - the local multimodal embedding service

## Quick Start

Install globally:

```bash
npm install -g vectraspace
```

If npm global install fails on macOS/Linux due to permissions, use:

```bash
pnpm add -g vectraspace
```

From your vectraspace workspace root:

```bash
vectraspace init
vectraspace start
```

Full install options are in [docs/INSTALL.md](docs/INSTALL.md).
Primary docs are on the website: https://vectraspace.org/docs

## What The Scripts Do

### `vectraspace setup`

- copies [.env.example](.env.example) to [.env](.env) if needed
- validates `docker compose`
- generates media root bind mounts for containers from `MEDIA_ROOTS`
- builds the app and embedding host images

### `vectraspace up`

- starts Qdrant, embedding host, and app containers with Docker Compose
- waits for health checks and returns when stack is ready
- keeps your terminal free (use `vectraspace logs` to follow logs)

### `vectraspace start`

- runs setup, starts all containers, waits for readiness, and opens the app in your browser
- best default command for non-technical users

A Node CLI for the common flows:

- `vectraspace onboard`
- `vectraspace setup`
- `vectraspace init`
- `vectraspace start`
- `vectraspace up`
- `vectraspace stop`
- `vectraspace down`
- `vectraspace logs`
- `vectraspace ps`
- `vectraspace doctor`
- `vectraspace index <directory>`
- `vectraspace search <query>`

## Requirements

- `docker`
- Qdrant is started by Compose

The compose file starts Qdrant for you.

## Environment

Create or update `app/.env` from `app/.env.example`, or run `vectraspace onboard` to configure it interactively.

Recommended semantic search settings:

```env
QDRANT_URL=http://127.0.0.1:6333
QDRANT_COLLECTION=media_semantic
EMBEDDING_PROVIDER=multimodal
MULTIMODAL_EMBEDDING_URL=http://127.0.0.1:8000/embed
MULTIMODAL_EMBEDDING_MODEL=Qwen/Qwen3-VL-Embedding-2B
MEDIA_ROOTS=/path/to/your/media
EMBEDDING_REINDEX_CONCURRENCY=1
```

## Embedding Host

The embedding host exposes a single endpoint:

- `POST /embed`

Request examples:

```json
{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "text", "text": "sunset over ocean" }
```

```json
{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "image", "imageBase64": "...", "filename": "image.jpg" }
```

It returns normalized vectors in the format:

```json
{ "embedding": [0.1, 0.2, 0.3] }
```

## Semantic Search Flow

1. Run `vectraspace start`.
2. Set `EMBEDDING_REINDEX_CONCURRENCY` in [.env](.env) if you want more parallel reindexing.
3. Index a directory: `vectraspace index /path/inside/your/media/root`.
4. Search from terminal: `vectraspace search "your query"`.
5. Use the Reindex button in the UI, or call `POST /api/search/reindex`.

## Manual Commands

If you want to run things separately:

```bash
docker compose up -d qdrant embedding-host app
```

```bash
docker compose logs -f --tail=100
```

## Troubleshooting

- If semantic search returns no results, check that Qdrant is running and that `/api/search/reindex` completed successfully.
- If embeddings fail to load, confirm the multimodal endpoint URL in [.env](.env) matches your local server.
- If you change the embedding model, recreate the Qdrant collection and reindex so vector dimensions stay consistent.
