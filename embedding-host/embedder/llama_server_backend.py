"""Image embedding via llama-server CLI (llama.cpp) with --mmproj support."""

from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import socket
import subprocess
import time
from typing import Any, Optional

from embedder import config as config_mod

logger = logging.getLogger("embedder")

_llama_server_process: Optional[subprocess.Popen] = None
_server_port: int = 0
_server_model_path: str = ""


def _find_llama_server() -> str:
    """Find llama-server binary."""
    path = config_mod.LLAMA_SERVER_PATH
    if path:
        return path

    # Try common locations
    candidates = [
        "llama-server",
        "./llama-server",
        os.path.expanduser("~/code/llama.cpp/build/bin/llama-server"),
        os.path.expanduser("~/llama.cpp/build/bin/llama-server"),
        "/usr/local/bin/llama-server",
    ]
    for candidate in candidates:
        if shutil.which(candidate):
            return candidate

    # Try to find in PATH
    found = shutil.which("llama-server")
    if found:
        return found

    raise RuntimeError("llama-server not found. Set LLAMA_SERVER_PATH or install llama.cpp.")


def _wait_for_server(port: int, timeout: float = 30.0) -> bool:
    """Wait for server to be ready."""
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1.0):
                return True
        except (socket.error, OSError):
            time.sleep(0.5)
    return False


def _find_free_port() -> int:
    """Find a free port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_llama_server(model_path: str, mmproj_path: Optional[str] = None) -> int:
    """Start llama-server with embedding and mmproj support. Returns the port."""
    global _llama_server_process, _server_port, _server_model_path

    if _llama_server_process is not None and _server_model_path == model_path:
        return _server_port

    # Stop existing server if different model
    if _llama_server_process is not None:
        stop_llama_server()

    model_ref = model_path.strip()
    if model_ref.lower().endswith(".gguf"):
        model_ref = os.path.expanduser(model_ref)

    # Find mmproj
    if not mmproj_path:
        mmproj_filename = config_mod.MMPROJ_FILENAME
        if mmproj_filename:
            model_dir = os.path.dirname(model_ref) if os.path.isfile(model_ref) else ""
            mmproj_path = os.path.join(model_dir, mmproj_filename)
            if not os.path.exists(mmproj_path):
                mmproj_path = os.path.expanduser(mmproj_filename)

    # Build llama-server command
    server_path = _find_llama_server()
    use_port = config_mod.LLAMA_SERVER_PORT
    if not use_port:
        use_port = _find_free_port()

    cmd = [
        server_path,
        "-m", model_ref,
        "--embedding",
        "--pooling", "mean",
        "-c", "8192",
        "-np", "1",
        "--port", str(use_port),
    ]

    if mmproj_path and os.path.exists(mmproj_path):
        cmd.extend(["--mmproj", mmproj_path])
        logger.info("starting_llama_server model=%s mmproj=%s port=%s", model_ref, mmproj_path, use_port)
    else:
        logger.warning("no_mmproj_found path=%s image_embedding_will_fail", mmproj_path)

    # Start server
    _llama_server_process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if not _wait_for_server(use_port):
        _llama_server_process.terminate()
        raise RuntimeError(f"llama-server failed to start on port {use_port}")

    _server_port = use_port
    _server_model_path = model_ref
    logger.info("llama_server_ready port=%s", _server_port)
    return _server_port


def stop_llama_server() -> None:
    """Stop llama-server."""
    global _llama_server_process, _server_port, _server_model_path

    if _llama_server_process is not None:
        _llama_server_process.terminate()
        try:
            _llama_server_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _llama_server_process.kill()
        _llama_server_process = None
        _server_port = 0
        _server_model_path = ""
        logger.info("llama_server_stopped")


def embed_text_via_server(text: str) -> list[float]:
    """Generate text embedding via llama-server API."""
    global _server_port
    if not _server_port:
        raise RuntimeError("llama-server not started. Call start_llama_server first.")

    import urllib.request
    import urllib.error

    url = f"http://127.0.0.1:{_server_port}/v1/embeddings"
    data = json.dumps({
        "model": "default",
        "input": text,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Embedding request failed: {e.read().decode('utf-8')}")

    if "data" in result and result["data"]:
        return result["data"][0].get("embedding", [])

    raise RuntimeError(f"Unexpected embedding response: {result}")


def embed_image_via_server(image_base64: str) -> list[float]:
    """Generate image embedding via llama-server API.
    
    Uses the new multimodal format from PR #15108:
    {
        "content": [
            {
                "prompt_string": "<image>",
                "multimodal_data": ["data:image/png;base64,..."]
            }
        ]
    }
    """
    global _server_port
    if not _server_port:
        raise RuntimeError("llama-server not started. Call start_llama_server first.")

    import urllib.request
    import urllib.error

    url = f"http://127.0.0.1:{_server_port}/embedding"
    
    # New format for multimodal embeddings
    content = [
        {
            "prompt_string": "<image>",
            "multimodal_data": [f"data:image/png;base64,{image_base64}"]
        }
    ]
    
    data = json.dumps({"content": content}).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"Image embedding request failed: {e.code} {error_body}")

    if "embedding" in result:
        emb = result["embedding"]
        # Normalize
        import math
        s = math.sqrt(sum(x * x for x in emb))
        if s > 0:
            return [x / s for x in emb]
        return emb

    raise RuntimeError(f"Unexpected embedding response: {result}")