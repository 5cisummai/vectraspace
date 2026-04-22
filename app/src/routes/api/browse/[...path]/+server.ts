import { json, error, isHttpError } from '@sveltejs/kit';
import { requireAuth, requirePathAccess, filterPersonalEntries } from '$lib/server/api';
import { listDirectory, listDirectoryTree } from '$lib/server/services/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const user = await requireAuth(locals);
	try {
		const relativePath = params.path ?? '';
		const recursive = url.searchParams.get('recursive') === '1';
		await requirePathAccess(user, relativePath);

		if (recursive) {
			const entries = await listDirectoryTree(relativePath, user);
			const filtered = await filterPersonalEntries(user, entries);
			return json(filtered);
		}

		const entries = await listDirectory(relativePath, user);
		const filtered = await filterPersonalEntries(user, entries);
		const safe = filtered.map((entry) => {
			const { fullPath, ...rest } = entry;
			void fullPath;
			return rest;
		});
		return json(safe);
	} catch (err) {
		if (isHttpError(err)) throw err;
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, message);
	}
};
