import { error, json } from '@sveltejs/kit';
import { ingestDirectoryByRootIndex } from '$lib/server/services/ingestion';
import type { RequestHandler } from './$types';

interface IngestDirectoryRequest {
	rootIndex?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.user?.role !== 'ADMIN') {
		throw error(403, 'Forbidden');
	}

	const body = (await request.json().catch(() => null)) as IngestDirectoryRequest | null;
	const rootIndex = body?.rootIndex;
	if (typeof rootIndex !== 'number' || !Number.isInteger(rootIndex)) {
		throw error(400, 'rootIndex must be an integer');
	}

	try {
		const summary = await ingestDirectoryByRootIndex(rootIndex);
		return json({ success: true, summary });
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Directory ingestion failed');
	}
};
