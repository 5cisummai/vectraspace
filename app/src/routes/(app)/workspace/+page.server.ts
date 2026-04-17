import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/api';
import { getWorkspace } from '$lib/server/services/workspace';
import { redirect } from '@sveltejs/kit';
import { workspacesEnabled } from '$lib/server/features';

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!workspacesEnabled) {
		redirect(302, '/home');
	}

	const { activeWorkspaceId } = await parent();

	if (!activeWorkspaceId) {
		return { workspace: null };
	}

	const user = await requireAuth(locals);

	return {
		workspace: await getWorkspace(activeWorkspaceId, user.id)
	};
};
