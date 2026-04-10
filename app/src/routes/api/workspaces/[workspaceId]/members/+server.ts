import { error, json } from '@sveltejs/kit';
import { getWorkspace, addMember } from '$lib/server/services/workspace';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { workspaceId, userId } = await requireWorkspaceAccess(event);

	try {
		const detail = await getWorkspace(workspaceId, userId);
		return json({ members: detail.members });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to list members';
		throw error(404, msg);
	}
};

interface AddMemberBody {
	userId?: string;
	role?: string;
}

export const POST: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event, 'ADMIN');

	const body = (await event.request.json().catch(() => null)) as AddMemberBody | null;
	if (!body?.userId?.trim()) throw error(400, 'userId is required');

	const role = body.role === 'ADMIN' ? 'ADMIN' : body.role === 'VIEWER' ? 'VIEWER' : 'MEMBER';

	try {
		const member = await addMember(workspaceId, body.userId, role);
		return json({ member }, { status: 201 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to add member';
		throw error(400, msg);
	}
};
