import type { LayoutServerLoad } from './$types';
import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants.js';
import { listWorkspacesForUser, ensureDefaultWorkspaceMembership } from '$lib/server/services/workspace';
import type { WorkspaceSummary } from '$lib/server/services/workspace';

export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	const raw = cookies.get(SIDEBAR_COOKIE_NAME);
	const sidebarOpen = raw === undefined ? true : raw === 'true';

	let workspaces: WorkspaceSummary[] = [];
	if (locals.user) {
		await ensureDefaultWorkspaceMembership(locals.user.id);
		workspaces = await listWorkspacesForUser(locals.user.id);
	}

	return { sidebarOpen, workspaces };
};
