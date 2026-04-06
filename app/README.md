# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.14.0 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:none" mcp="ide:vscode+setup:remote" sveltekit-adapter="adapter:auto" --install pnpm frontend
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Step 8: Semantic Search (Qdrant)

This project includes backend semantic search endpoints powered by local embeddings and Qdrant.
The recommended model is a multimodal embedding model such as `Qwen/Qwen3-VL-Embedding-2B`.

### Configure environment

Copy `.env.example` values into your local `.env` and set:

- `MEDIA_ROOTS`
- `QDRANT_URL` (and optional `QDRANT_API_KEY`)
- `EMBEDDING_PROVIDER=multimodal`
- `MULTIMODAL_EMBEDDING_URL`
- `MULTIMODAL_EMBEDDING_MODEL` (default shown in the template)

The multimodal endpoint should accept both text and image payloads and return a single embedding vector in the same space for both.

Optional fallback providers:

- `EMBEDDING_PROVIDER=ollama` or `EMBEDDING_PROVIDER=openai`
- Provider-specific model settings

If the multimodal endpoint is unavailable, image files fall back to metadata text embedding.

### Run Qdrant locally

Docker example:

```sh
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

If you already run Qdrant locally, point `QDRANT_URL` to that instance.

Suggested local multimodal service contract:

- `POST /embed`
- Request JSON:
	- `{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "text", "text": "..." }`
	- `{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "image", "imageBase64": "...", "filename": "..." }`
- Response JSON:
	- `{ "embedding": [0.1, 0.2, ...] }`

### API endpoints

- `POST /api/search/reindex`
	- Full reindex of all media roots
	- Upserts current vectors and deletes stale points

- `GET /api/search?q=...&mediaType=image&root=0&limit=25`
	- Semantic query
	- Optional filters: `mediaType`, `root`, `limit`

Incremental indexing is also executed after successful `POST /api/upload`.
