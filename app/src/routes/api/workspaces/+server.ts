import { error, json } from '@sveltejs/kit';
import {
	createWorkspace,
	listWorkspacesForUser
} from '$lib/server/services/workspace';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const workspaces = await listWorkspacesForUser(locals.user.id);
	return json({ workspaces });
};

interface CreateWorkspaceBody {
	name?: string;
	slug?: string;
	description?: string;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = (await request.json().catch(() => null)) as CreateWorkspaceBody | null;
	if (!body?.name?.trim() || !body?.slug?.trim()) {
		throw error(400, 'name and slug are required');
	}

	try {
		const workspace = await createWorkspace(
			body.name,
			body.slug,
			locals.user.id,
			body.description
		);
		return json({ workspace }, { status: 201 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Failed to create workspace';
		throw error(400, msg);
	}
};
