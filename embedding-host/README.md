# Embedding Host (Qwen3-VL)

This service hosts a local multimodal embedding endpoint for semantic search.

## API Contract

- `POST /embed`
- Request JSON:
  - Text: `{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "text", "text": "..." }`
  - Image: `{ "model": "Qwen/Qwen3-VL-Embedding-2B", "type": "image", "imageBase64": "...", "filename": "..." }`
- Response JSON:
  - `{ "embedding": [0.1, 0.2, ...] }`

## Setup

1. Create and activate virtual environment:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Optional Hugging Face auth token (if needed):

```bash
export HF_TOKEN=your_hf_token
```

4. Run server:

```bash
uvicorn app:app --host 127.0.0.1 --port 8000
```

5. Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Test Requests

Text embedding:

```bash
curl -X POST http://127.0.0.1:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"model":"Qwen/Qwen3-VL-Embedding-2B","type":"text","text":"sunset over ocean"}'
```

Image embedding:

```bash
IMG_B64=$(base64 -i /path/to/image.jpg | tr -d '\n')
curl -X POST http://127.0.0.1:8000/embed \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"Qwen/Qwen3-VL-Embedding-2B\",\"type\":\"image\",\"imageBase64\":\"$IMG_B64\",\"filename\":\"image.jpg\"}"
```

## App Integration

In your main app `.env`:

```env
EMBEDDING_PROVIDER=multimodal
MULTIMODAL_EMBEDDING_URL=http://127.0.0.1:8000/embed
MULTIMODAL_EMBEDDING_MODEL=Qwen/Qwen3-VL-Embedding-2B
```
