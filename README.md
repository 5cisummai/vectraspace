# Media Server Workspace

This workspace contains two parts:

- [app](app) - the SvelteKit media server UI and API
- [embedding-host](embedding-host) - the local multimodal embedding service

## Quick Start

From the workspace root:

```bash
./setup.sh
./run.sh
```

## What The Scripts Do

### `setup.sh`

- installs Node dependencies for [app](app)
- builds the app once to verify it compiles
- creates `embedding-host/.venv` if needed
- installs Python dependencies for the embedding host
- validates `embedding-host/app.py`

### `run.sh`

- starts the embedding host on `http://127.0.0.1:8000`
- starts the app dev server in [app](app)
- stops the embedding host when you exit the script

## Requirements

- `pnpm`
- `python3.11`
- Qdrant running locally

Example Qdrant container:

```bash
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

## Environment

Copy the values in [.env.example](.env.example) into your local [.env](.env) and adjust paths as needed.

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

1. Run Qdrant.
2. Run `./run.sh`.
3. Set `EMBEDDING_REINDEX_CONCURRENCY` in [.env](.env) if you want more parallel reindexing.
4. Use the Reindex button in the UI, or call `POST /api/search/reindex`.
5. Search from the top bar in the app.

## Manual Commands

If you want to run things separately:

```bash
cd app
pnpm dev
```

```bash
cd embedding-host
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

## Troubleshooting

- If semantic search returns no results, check that Qdrant is running and that `/api/search/reindex` completed successfully.
- If embeddings fail to load, confirm the multimodal endpoint URL in [.env](.env) matches your local server.
- If you change the embedding model, recreate the Qdrant collection and reindex so vector dimensions stay consistent.
