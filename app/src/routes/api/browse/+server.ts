import { json, error } from '@sveltejs/kit';
import { listDirectoryTree } from '$lib/server/services/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const entries = await listDirectoryTree('');
		return json(entries);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, message);
	}
};