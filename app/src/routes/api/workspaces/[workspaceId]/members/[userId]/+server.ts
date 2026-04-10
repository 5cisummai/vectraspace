import { error, json } from '@sveltejs/kit';
import { updateMemberRole, removeMember } from '$lib/server/services/workspace';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

interface UpdateRoleBody {
	role?: string;
}

export const PATCH: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event, 'ADMIN');

	const targetUserId = event.params.userId;
	if (!targetUserId) throw error(400, 'userId is required');

	const body = (await event.request.json().catch(() => null)) as UpdateRoleBody | null;
	if (!body?.role) throw error(400, 'role is required');

	const role = body.role === 'ADMIN' ? 'ADMIN' : body.role === 'VIEWER' ? 'VIEWER' : 'MEMBER';

	try {
		await updateMemberRole(workspaceId, targetUserId, role);
		return json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to update member role';
		throw error(400, msg);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event, 'ADMIN');

	const targetUserId = event.params.userId;
	if (!targetUserId) throw error(400, 'userId is required');

	try {
		await removeMember(workspaceId, targetUserId);
		return json({ ok: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to remove member';
		throw error(400, msg);
	}
};
