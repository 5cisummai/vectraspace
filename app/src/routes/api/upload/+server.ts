import { json, error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isPathInsideRoot, resolveSafePath } from '$lib/server/storage';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const maxUploadSize = parseInt(env.MAX_UPLOAD_SIZE ?? '10737418240', 10);
	const contentLength = request.headers.get('content-length');

	if (contentLength && parseInt(contentLength, 10) > maxUploadSize) {
		throw error(413, 'File too large');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const destination = formData.get('destination') as string | null;

	if (!file) throw error(400, 'No file provided');
	if (!destination) throw error(400, 'No destination provided');

	const resolved = resolveSafePath(destination);
	if (!resolved) throw error(400, 'Invalid destination path');

	// Sanitize filename — strip path separators, null bytes
	const safeName = path
		.basename(file.name)
		.replace(/[/\\]/g, '')
		.replace(/\0/g, '');

	if (!safeName) throw error(400, 'Invalid filename');

	const destPath = path.resolve(resolved.fullPath, safeName);

	// Ensure destination is still inside the root after joining
	if (!isPathInsideRoot(destPath, resolved.root)) {
		throw error(400, 'Invalid destination');
	}

	// Ensure destination directory exists
	await fs.mkdir(resolved.fullPath, { recursive: true });

	// Stream file to disk
	const arrayBuffer = await file.arrayBuffer();
	await fs.writeFile(destPath, Buffer.from(arrayBuffer));

	const relativePath = path.join(destination, safeName).split(path.sep).join('/');

	return json({ success: true, name: safeName, relativePath });
};