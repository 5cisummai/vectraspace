import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reindexSemanticCollection } from '$lib/server/semantic';

export const POST: RequestHandler = async () => {
	try {
		const summary = await reindexSemanticCollection();
		return json({ success: true, summary });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Reindex failed';
		throw error(500, message);
	}
};
