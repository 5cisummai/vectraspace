import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reindexSemanticCollection } from '$lib/server/semantic';

interface ReindexRequestBody {
	concurrency?: number;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		let concurrency: number | undefined;
		try {
			const body = (await request.json()) as ReindexRequestBody;
			concurrency = body.concurrency;
		} catch {
			concurrency = undefined;
		}

		const summary = await reindexSemanticCollection({ concurrency });
		return json({ success: true, summary });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Reindex failed';
		throw error(500, message);
	}
};
