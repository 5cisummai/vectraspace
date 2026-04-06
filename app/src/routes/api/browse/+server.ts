import { json, error } from '@sveltejs/kit';
import { listDirectory } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const entries = await listDirectory('');
		const safe = entries.map(({ fullPath: _, ...rest }) => rest);
		return json(safe);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, message);
	}
};