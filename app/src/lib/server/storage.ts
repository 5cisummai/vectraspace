import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';

export type MediaType = 'video' | 'audio' | 'image' | 'document' | 'other';

export interface MediaEntry {
	name: string;
	path: string;       // relative path from a media root (safe to expose)
	fullPath: string;   // absolute path on disk (never expose to client)
	type: 'file' | 'directory';
	mediaType?: MediaType;
	size?: number;
	modified?: string;
	mimeType?: string;
}

const MEDIA_EXTENSIONS: Record<string, { mediaType: MediaType; mimeType: string }> = {
	// Video
	mp4:  { mediaType: 'video', mimeType: 'video/mp4' },
	mkv:  { mediaType: 'video', mimeType: 'video/x-matroska' },
	webm: { mediaType: 'video', mimeType: 'video/webm' },
	avi:  { mediaType: 'video', mimeType: 'video/x-msvideo' },
	mov:  { mediaType: 'video', mimeType: 'video/quicktime' },
	// Audio
	mp3:  { mediaType: 'audio', mimeType: 'audio/mpeg' },
	flac: { mediaType: 'audio', mimeType: 'audio/flac' },
	ogg:  { mediaType: 'audio', mimeType: 'audio/ogg' },
	wav:  { mediaType: 'audio', mimeType: 'audio/wav' },
	aac:  { mediaType: 'audio', mimeType: 'audio/aac' },
	m4a:  { mediaType: 'audio', mimeType: 'audio/mp4' },
	// Images
	jpg:  { mediaType: 'image', mimeType: 'image/jpeg' },
	jpeg: { mediaType: 'image', mimeType: 'image/jpeg' },
	png:  { mediaType: 'image', mimeType: 'image/png' },
	gif:  { mediaType: 'image', mimeType: 'image/gif' },
	webp: { mediaType: 'image', mimeType: 'image/webp' },
	avif: { mediaType: 'image', mimeType: 'image/avif' },
	svg:  { mediaType: 'image', mimeType: 'image/svg+xml' },
	// Documents
	pdf:  { mediaType: 'document', mimeType: 'application/pdf' },
	epub: { mediaType: 'document', mimeType: 'application/epub+zip' },
	cbz:  { mediaType: 'document', mimeType: 'application/zip' },
	cbr:  { mediaType: 'document', mimeType: 'application/x-rar-compressed' },
};

// Parse MEDIA_ROOTS from env — supports multiple comma-separated paths
export function getMediaRoots(): string[] {
	const raw = env.MEDIA_ROOTS ?? '';
	return raw
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean);
}

// Resolve a client-supplied relative path safely — prevents path traversal attacks
export function resolveSafePath(relativePath: string): { fullPath: string; root: string } | null {
	const roots = getMediaRoots();
	if (roots.length === 0) return null;

	// Strip leading slashes, normalize
	const cleaned = path.normalize(relativePath.replace(/^[/\\]+/, ''));

	// Determine which root this path belongs to by prefix
	// Path format from client: "rootIndex/rest/of/path"
	const [rootIndexStr, ...rest] = cleaned.split(path.sep);
	const rootIndex = parseInt(rootIndexStr, 10);

	if (isNaN(rootIndex) || rootIndex < 0 || rootIndex >= roots.length) {
		return null;
	}

	const root = roots[rootIndex];
	const relative = rest.join(path.sep);
	const fullPath = path.join(root, relative);

	// Security: ensure resolved path is still inside the root
	if (!fullPath.startsWith(path.resolve(root))) {
		return null;
	}

	return { fullPath, root };
}

export function getMediaInfo(filename: string) {
	const ext = path.extname(filename).slice(1).toLowerCase();
	return MEDIA_EXTENSIONS[ext] ?? { mediaType: 'other' as MediaType, mimeType: 'application/octet-stream' };
}

// List contents of a directory path (relative, client-safe)
export async function listDirectory(relativePath: string): Promise<MediaEntry[]> {
	const roots = getMediaRoots();
	if (roots.length === 0) throw new Error('No media roots configured');

	// Root-level: merge all roots into one virtual directory
	if (!relativePath || relativePath === '/') {
		const entries: MediaEntry[] = [];
		for (let i = 0; i < roots.length; i++) {
			try {
				const stat = await fs.stat(roots[i]);
				entries.push({
					name: path.basename(roots[i]),
					path: `${i}`,
					fullPath: roots[i],
					type: 'directory',
					modified: stat.mtime.toISOString(),
				});
			} catch {
				// Drive not available — skip silently
			}
		}
		return entries;
	}

	const resolved = resolveSafePath(relativePath);
	if (!resolved) throw new Error('Invalid path');

	const dirents = await fs.readdir(resolved.fullPath, { withFileTypes: true });
	const entries: MediaEntry[] = [];

	for (const dirent of dirents) {
		if (dirent.name.startsWith('.')) continue; // skip hidden files

		const fullPath = path.join(resolved.fullPath, dirent.name);
		const childRelative = path.join(relativePath, dirent.name);
		const isDir = dirent.isDirectory();

		if (isDir) {
			const stat = await fs.stat(fullPath);
			entries.push({
				name: dirent.name,
				path: childRelative,
				fullPath,
				type: 'directory',
				modified: stat.mtime.toISOString(),
			});
		} else {
			const { mediaType, mimeType } = getMediaInfo(dirent.name);
			const stat = await fs.stat(fullPath);
			entries.push({
				name: dirent.name,
				path: childRelative,
				fullPath,
				type: 'file',
				mediaType,
				mimeType,
				size: stat.size,
				modified: stat.mtime.toISOString(),
			});
		}
	}

	// Directories first, then files, both alphabetical
	return entries.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}