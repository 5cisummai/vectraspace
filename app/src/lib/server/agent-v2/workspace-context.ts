import { error } from '@sveltejs/kit';
import { workspacesEnabled } from '$lib/server/features';
import {
	ensureDefaultWorkspaceMembership,
	getDefaultWorkspaceId
} from '$lib/server/services/workspace';

export type ResolvedAgentWorkspace = {
	workspaceId: string;
	mode: 'explicit' | 'default';
};

/**
 * Resolves the effective workspace for agent routes.
 * When workspaces are product-disabled, always use the default workspace (path segment ignored for authz).
 */
export async function resolveAgentWorkspaceForUser(
	userId: string,
	pathWorkspaceId: string
): Promise<ResolvedAgentWorkspace> {
	if (!workspacesEnabled) {
		let wid = await getDefaultWorkspaceId();
		if (!wid) {
			wid = await ensureDefaultWorkspaceMembership(userId);
		}
		return { workspaceId: wid, mode: 'default' };
	}
	if (!pathWorkspaceId?.trim()) {
		throw error(400, 'workspaceId is required');
	}
	return { workspaceId: pathWorkspaceId, mode: 'explicit' };
}
