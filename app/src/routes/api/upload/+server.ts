import { json, error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import * as path from '$lib/server/paths';
import { isPathInsideRoot, resolveSafePath } from '$lib/server/services/storage';
import { requireAuth, requirePathAccess } from '$lib/server/api';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { recordAction, FsOperation } from '$lib/server/fs-history';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = await requireAuth(locals);

	const maxUploadSize = parseInt(env.MAX_UPLOAD_SIZE ?? '10737418240', 10);
	const contentLength = request.headers.get('content-length');

	if (contentLength && parseInt(contentLength, 10) > maxUploadSize) {
		throw error(413, 'File too large');
	}

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const destination = formData.get('destination') as string | null;
	const workspaceId = formData.get('workspaceId') as string | null;

	if (!file) throw error(400, 'No file provided');
	if (!destination) throw error(400, 'No destination provided');

	await requirePathAccess(user, destination);

	const resolved = resolveSafePath(destination);
	if (!resolved) throw error(400, 'Invalid destination path');

	// Sanitize filename — strip path separators, null bytes
	const safeName = path.basename(file.name).replace(/[/\\]/g, '').replace(/\0/g, '');

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

	const relativePath = path.join(destination, safeName);

	// Record ownership (upsert in case the file is overwritten)
	await db.uploadedFile.upsert({
		where: { relativePath },
		create: { relativePath, uploadedById: user.id },
		update: { uploadedById: user.id, uploadedAt: new Date() }
	});

	await recordAction({
		userId: user.id,
		workspaceId: workspaceId ?? null,
		operation: FsOperation.UPLOAD,
		payload: { relativePath },
		description: `Uploaded ${relativePath}`
	});

	return json({ success: true, name: safeName, relativePath });
};
