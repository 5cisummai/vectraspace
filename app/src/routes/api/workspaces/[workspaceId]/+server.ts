import { error, json } from '@sveltejs/kit';
import {
	getWorkspace,
	updateWorkspace,
	deleteWorkspace
} from '$lib/server/services/workspace';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { workspaceId, userId } = await requireWorkspaceAccess(event);

	try {
		const workspace = await getWorkspace(workspaceId, userId);
		return json({ workspace });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Workspace not found';
		throw error(404, msg);
	}
};

interface UpdateWorkspaceBody {
	name?: string;
	slug?: string;
	description?: string;
}

export const PATCH: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event, 'ADMIN');

	const body = (await event.request.json().catch(() => null)) as UpdateWorkspaceBody | null;
	if (!body) throw error(400, 'Invalid JSON body');

	try {
		await updateWorkspace(workspaceId, body);
		return json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to update workspace';
		throw error(400, msg);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event, 'ADMIN');

	try {
		await deleteWorkspace(workspaceId);
		return json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to delete workspace';
		throw error(400, msg);
	}
};
