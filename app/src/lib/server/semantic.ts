import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getMediaInfo, getMediaRoots, resolveSafePath, type MediaEntry, type MediaType } from '$lib/server/storage';

export interface SearchResult {
	id: string;
	score: number;
	name: string;
	path: string;
	type: 'file';
	mediaType: MediaType;
	mimeType?: string;
	size?: number;
	modified?: string;
	rootIndex: number;
}

interface QdrantPoint {
	id: string;
	vector: number[];
	payload: Record<string, unknown>;
}

interface QdrantScrollResponse {
	result?: {
		points?: Array<{ id: string | number }>;
		next_page_offset?: string | number | null;
	};
}

interface ReindexSummary {
	totalFiles: number;
	indexed: number;
	skipped: number;
	deleted: number;
	imageContentEmbeddingsUsed: number;
}

function normalizeVector(vector: number[]): number[] {
	let norm = 0;
	for (const value of vector) norm += value * value;
	norm = Math.sqrt(norm);
	if (norm === 0) return vector;
	return vector.map((value) => value / norm);
}

function createPointId(relativePath: string): string {
	const digest = createHash('sha1').update(relativePath).digest();
	const bytes = Buffer.from(digest.subarray(0, 16));
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildMetadataText(entry: MediaEntry): string {
	const ext = path.extname(entry.name).slice(1).toLowerCase();
	const parts = [
		entry.name,
		entry.path,
		entry.mediaType ?? 'other',
		ext ? `ext:${ext}` : '',
		entry.type,
		entry.mimeType ?? ''
	].filter(Boolean);
	return parts.join(' | ');
}

type EmbeddingProvider = 'multimodal' | 'ollama' | 'openai';

function embeddingProvider(): EmbeddingProvider {
	const provider = (env.EMBEDDING_PROVIDER ?? (env.MULTIMODAL_EMBEDDING_URL ? 'multimodal' : 'ollama')).toLowerCase();
	if (provider === 'openai') return 'openai';
	if (provider === 'multimodal' || provider === 'qwen-vl') return 'multimodal';
	return 'ollama';
}

async function embedWithMultimodal(input: {
	type: 'text' | 'image';
	text?: string;
	imageBase64?: string;
	filename?: string;
}): Promise<number[]> {
	const endpoint = env.MULTIMODAL_EMBEDDING_URL;
	if (!endpoint) {
		throw new Error('MULTIMODAL_EMBEDDING_URL is required when EMBEDDING_PROVIDER=multimodal');
	}

	const model = env.MULTIMODAL_EMBEDDING_MODEL ?? 'Qwen/Qwen3-VL-Embedding-2B';
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (env.MULTIMODAL_EMBEDDING_API_KEY) {
		headers.Authorization = `Bearer ${env.MULTIMODAL_EMBEDDING_API_KEY}`;
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			model,
			...input
		})
	});

	if (!response.ok) {
		throw new Error(`Multimodal embedding request failed: ${response.status} ${response.statusText}`);
	}

	const body = (await response.json()) as { embedding?: number[] };
	if (!Array.isArray(body.embedding)) {
		throw new Error('Multimodal embedding response did not include an embedding vector');
	}

	return normalizeVector(body.embedding);
}

async function embedTextWithOllama(input: string): Promise<number[]> {
	const baseUrl = env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
	const model = env.OLLAMA_EMBED_MODEL ?? env.OLLAMA_MODEL ?? 'nomic-embed-text';

	const response = await fetch(`${baseUrl}/api/embeddings`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, prompt: input })
	});

	if (!response.ok) {
		throw new Error(`Ollama embedding request failed: ${response.status} ${response.statusText}`);
	}

	const body = (await response.json()) as { embedding?: number[] };
	if (!Array.isArray(body.embedding)) {
		throw new Error('Ollama embedding response did not include an embedding vector');
	}

	return normalizeVector(body.embedding);
}

async function embedTextWithOpenAICompatible(input: string): Promise<number[]> {
	const baseUrl = env.OPENAI_BASE_URL ?? 'http://127.0.0.1:1234/v1';
	const model = env.OPENAI_EMBED_MODEL ?? env.OPENAI_MODEL;
	if (!model) {
		throw new Error('OPENAI_EMBED_MODEL (or OPENAI_MODEL) is required when EMBEDDING_PROVIDER=openai');
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (env.OPENAI_API_KEY) headers.Authorization = `Bearer ${env.OPENAI_API_KEY}`;

	const response = await fetch(`${baseUrl}/embeddings`, {
		method: 'POST',
		headers,
		body: JSON.stringify({
			model,
			input
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI-compatible embedding request failed: ${response.status} ${response.statusText}`);
	}

	const body = (await response.json()) as {
		data?: Array<{ embedding?: number[] }>;
	};

	const embedding = body.data?.[0]?.embedding;
	if (!Array.isArray(embedding)) {
		throw new Error('OpenAI-compatible embedding response did not include an embedding vector');
	}

	return normalizeVector(embedding);
}

async function embedText(input: string): Promise<number[]> {
	const provider = embeddingProvider();
	if (provider === 'multimodal') {
		return embedWithMultimodal({ type: 'text', text: input });
	}
	if (provider === 'openai') {
		return embedTextWithOpenAICompatible(input);
	}
	return embedTextWithOllama(input);
}

async function embedImageWithMultimodal(filePath: string): Promise<number[] | null> {
	const provider = embeddingProvider();
	if (provider !== 'multimodal') return null;

	const bytes = await fs.readFile(filePath);
	return embedWithMultimodal({
		type: 'image',
		imageBase64: bytes.toString('base64'),
		filename: path.basename(filePath)
	});
}

async function qdrantRequest<T>(requestPath: string, init?: RequestInit): Promise<T> {
	const baseUrl = env.QDRANT_URL ?? 'http://127.0.0.1:6333';
	const headers = new Headers(init?.headers ?? {});
	headers.set('Content-Type', 'application/json');
	if (env.QDRANT_API_KEY) headers.set('api-key', env.QDRANT_API_KEY);

	const response = await fetch(`${baseUrl}${requestPath}`, {
		...init,
		headers
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(`Qdrant request failed (${response.status}): ${message}`);
	}

	return (await response.json()) as T;
}

function collectionName(): string {
	return env.QDRANT_COLLECTION ?? 'media_semantic';
}

async function collectionExists(): Promise<boolean> {
	const baseUrl = env.QDRANT_URL ?? 'http://127.0.0.1:6333';
	const headers = new Headers();
	if (env.QDRANT_API_KEY) headers.set('api-key', env.QDRANT_API_KEY);

	const response = await fetch(`${baseUrl}/collections/${collectionName()}`, { headers });
	if (response.status === 404) return false;
	if (!response.ok) {
		const message = await response.text();
		throw new Error(`Qdrant request failed (${response.status}): ${message}`);
	}
	return true;
}

async function ensureCollection(vectorSize: number): Promise<void> {
	if (await collectionExists()) return;

	await qdrantRequest(`/collections/${collectionName()}`, {
		method: 'PUT',
		body: JSON.stringify({
			vectors: {
				size: vectorSize,
				distance: 'Cosine'
			}
		})
	});
}

async function upsertPoints(points: QdrantPoint[]): Promise<void> {
	if (points.length === 0) return;
	await qdrantRequest(`/collections/${collectionName()}/points?wait=true`, {
		method: 'PUT',
		body: JSON.stringify({ points })
	});
}

async function scrollPointIds(): Promise<Set<string>> {
	const ids = new Set<string>();
	if (!(await collectionExists())) return ids;

	let offset: string | number | null = null;

	for (;;) {
		const response: QdrantScrollResponse = await qdrantRequest<QdrantScrollResponse>(
			`/collections/${collectionName()}/points/scroll`,
			{
			method: 'POST',
			body: JSON.stringify({
				limit: 512,
				offset,
				with_vector: false,
				with_payload: false
			})
			}
		);

		const points = response.result?.points ?? [];
		for (const point of points) ids.add(String(point.id));
		offset = response.result?.next_page_offset ?? null;
		if (!offset) break;
	}

	return ids;
}

async function deletePoints(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await qdrantRequest(`/collections/${collectionName()}/points/delete?wait=true`, {
		method: 'POST',
		body: JSON.stringify({ points: ids })
	});
}

async function toMediaFileEntry(relativePath: string): Promise<MediaEntry | null> {
	const resolved = resolveSafePath(relativePath);
	if (!resolved) return null;

	const stat = await fs.stat(resolved.fullPath);
	if (!stat.isFile()) return null;

	const { mediaType, mimeType } = getMediaInfo(resolved.fullPath);
	return {
		name: path.basename(resolved.fullPath),
		path: relativePath,
		fullPath: resolved.fullPath,
		type: 'file',
		mediaType,
		mimeType,
		size: stat.size,
		modified: stat.mtime.toISOString()
	};
}

async function walkRoot(rootPath: string, rootIndex: number, relativePrefix = ''): Promise<MediaEntry[]> {
	let dirents;
	try {
		dirents = await fs.readdir(path.join(rootPath, relativePrefix), { withFileTypes: true });
	} catch {
		return [];
	}

	const files: MediaEntry[] = [];
	for (const dirent of dirents) {
		if (dirent.name.startsWith('.')) continue;

		const nextRelative = relativePrefix ? path.join(relativePrefix, dirent.name) : dirent.name;
		const fullPath = path.join(rootPath, nextRelative);

		if (dirent.isDirectory()) {
			const nested = await walkRoot(rootPath, rootIndex, nextRelative);
			files.push(...nested);
			continue;
		}

		if (!dirent.isFile()) continue;

		const stat = await fs.stat(fullPath);
		const clientPath = `${rootIndex}/${nextRelative.split(path.sep).join('/')}`;
		const { mediaType, mimeType } = getMediaInfo(dirent.name);
		files.push({
			name: dirent.name,
			path: clientPath,
			fullPath,
			type: 'file',
			mediaType,
			mimeType,
			size: stat.size,
			modified: stat.mtime.toISOString()
		});
	}

	return files;
}

async function collectAllFiles(): Promise<MediaEntry[]> {
	const roots = getMediaRoots();
	const all: MediaEntry[] = [];

	for (let i = 0; i < roots.length; i++) {
		const files = await walkRoot(roots[i], i);
		all.push(...files);
	}

	return all;
}

function rootIndexFromPath(relativePath: string): number {
	const first = relativePath.split('/')[0];
	const parsed = Number.parseInt(first ?? '', 10);
	return Number.isNaN(parsed) ? -1 : parsed;
}

async function makePoint(entry: MediaEntry): Promise<{ point: QdrantPoint; usedImageEmbedding: boolean }> {
	const metadataText = buildMetadataText(entry);
	let vector = await embedText(metadataText);
	let usedImageEmbedding = false;

	if (entry.mediaType === 'image') {
		try {
			const maybeImageVector = await embedImageWithMultimodal(entry.fullPath);
			if (maybeImageVector) {
				vector = maybeImageVector;
				usedImageEmbedding = true;
			}
		} catch (err) {
			console.warn('Image embedding failed, falling back to metadata embedding:', err);
		}
	}

	const point: QdrantPoint = {
		id: createPointId(entry.path),
		vector,
		payload: {
			name: entry.name,
			path: entry.path,
			type: entry.type,
			mediaType: entry.mediaType ?? 'other',
			mimeType: entry.mimeType,
			size: entry.size,
			modified: entry.modified,
			rootIndex: rootIndexFromPath(entry.path)
		}
	};

	return { point, usedImageEmbedding };
}

export async function reindexSemanticCollection(): Promise<ReindexSummary> {
	const files = await collectAllFiles();
	if (files.length === 0) {
		return {
			totalFiles: 0,
			indexed: 0,
			skipped: 0,
			deleted: 0,
			imageContentEmbeddingsUsed: 0
		};
	}

	const existingIds = await scrollPointIds();

	let indexed = 0;
	let skipped = 0;
	let imageContentEmbeddingsUsed = 0;
	const newIds = new Set<string>();
	let buffer: QdrantPoint[] = [];
	let ensured = false;

	for (const file of files) {
		try {
			const { point, usedImageEmbedding } = await makePoint(file);
			if (!ensured) {
				await ensureCollection(point.vector.length);
				ensured = true;
			}

			buffer.push(point);
			newIds.add(point.id);
			indexed++;
			if (usedImageEmbedding) imageContentEmbeddingsUsed++;

			if (buffer.length >= 64) {
				await upsertPoints(buffer);
				buffer = [];
			}
		} catch (err) {
			skipped++;
			console.warn('Failed to index file:', file.path, err);
		}
	}

	if (buffer.length > 0) {
		await upsertPoints(buffer);
	}

	const stale = Array.from(existingIds).filter((id) => !newIds.has(id));
	await deletePoints(stale);

	return {
		totalFiles: files.length,
		indexed,
		skipped,
		deleted: stale.length,
		imageContentEmbeddingsUsed
	};
}

export async function indexFileByRelativePath(relativePath: string): Promise<boolean> {
	const entry = await toMediaFileEntry(relativePath);
	if (!entry) return false;

	const { point } = await makePoint(entry);
	await ensureCollection(point.vector.length);
	await upsertPoints([point]);
	return true;
}

export async function semanticSearch(query: string, options?: { mediaType?: MediaType; rootIndex?: number; limit?: number }): Promise<SearchResult[]> {
	const vector = await embedText(query);
	const limit = Math.max(1, Math.min(options?.limit ?? 30, 100));

	const must: Array<Record<string, unknown>> = [];
	if (options?.mediaType) {
		must.push({ key: 'mediaType', match: { value: options.mediaType } });
	}
	if (typeof options?.rootIndex === 'number') {
		must.push({ key: 'rootIndex', match: { value: options.rootIndex } });
	}

	const response = await qdrantRequest<{
		result?: Array<{
			id: string | number;
			score: number;
			payload?: Record<string, unknown>;
		}>;
	}>(`/collections/${collectionName()}/points/search`, {
		method: 'POST',
		body: JSON.stringify({
			vector,
			limit,
			with_payload: true,
			with_vector: false,
			filter: must.length > 0 ? { must } : undefined
		})
	});

	const rows = response.result ?? [];
	return rows
		.map((row) => {
			const payload = row.payload ?? {};
			return {
				id: String(row.id),
				score: row.score,
				name: String(payload.name ?? ''),
				path: String(payload.path ?? ''),
				type: 'file' as const,
				mediaType: (payload.mediaType as MediaType) ?? 'other',
				mimeType: payload.mimeType ? String(payload.mimeType) : undefined,
				size: typeof payload.size === 'number' ? payload.size : undefined,
				modified: payload.modified ? String(payload.modified) : undefined,
				rootIndex: typeof payload.rootIndex === 'number' ? payload.rootIndex : -1
			};
		})
		.filter((entry) => entry.path.length > 0);
}
