import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/api';
import { undoUserAction } from '$lib/server/fs-history';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = await requireAuth(locals);
	const body = await request.json().catch(() => ({}));
	const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null;

	let action;
	try {
		action = await undoUserAction(user.id, workspaceId);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Undo failed';
		throw error(400, message);
	}

	if (!action) {
		throw error(404, 'Nothing to undo');
	}

	return json({ action });
};
