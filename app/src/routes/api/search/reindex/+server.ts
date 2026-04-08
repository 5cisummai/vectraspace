import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reindexSemanticCollection } from '$lib/server/semantic';

export const POST: RequestHandler = async ({ locals }) => {
	if (locals.user?.role !== 'ADMIN') {
		throw error(403, 'Forbidden');
	}

	try {
		const summary = await reindexSemanticCollection();
		return json({ success: true, summary });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Reindex failed';
		throw error(500, message);
	}
};
