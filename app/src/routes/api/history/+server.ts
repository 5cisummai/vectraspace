import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api';
import { listHistory } from '$lib/server/fs-history';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = await requireAuth(locals);
	const workspaceId = url.searchParams.get('workspaceId');
	const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

	const actions = await listHistory(workspaceId, Math.min(limit, 50));
	return json(actions);
};
