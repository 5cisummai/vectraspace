import { error, json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import { getMediaInfo, resolveSafePath } from '$lib/server/storage';
import { deleteSemanticEntryByRelativePath } from '$lib/server/semantic';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const relativePath = params.path ?? '';
	const resolved = resolveSafePath(relativePath);
	if (!resolved) throw error(400, 'Invalid path');

	const stat = await fs.stat(resolved.fullPath);
	if (!stat.isFile()) throw error(400, 'Only files can be deleted');

	const { mediaType } = getMediaInfo(resolved.fullPath);
	if (mediaType !== 'image') throw error(400, 'Only image files can be deleted from the browse view');

	try {
		await fs.unlink(resolved.fullPath);
	} catch (err) {
		if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, 'File not found');
		}
		throw err;
	}

	try {
		await deleteSemanticEntryByRelativePath(relativePath);
	} catch (err) {
		console.warn('Failed to delete semantic index entry:', relativePath, err);
	}

	return json({ success: true });
};