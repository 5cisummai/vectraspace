import { error } from '@sveltejs/kit';
import { requireMembership } from '$lib/server/services/workspace';
import { resolveAgentWorkspaceForUser } from '$lib/server/agent-v2/workspace-context';
import type { WorkspaceRole } from '@prisma/client';

export type { WorkspaceRole };

/**
 * Validate workspace membership from a SvelteKit request event.
 * Returns the workspace ID and user's role.
 */
export async function requireWorkspaceAccess(
	event: { locals: App.Locals; params: Record<string, string> },
	minRole: WorkspaceRole = 'VIEWER'
): Promise<{ workspaceId: string; userId: string; role: WorkspaceRole }> {
	const user = event.locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const workspaceId = event.params.workspaceId;
	if (!workspaceId) throw error(400, 'workspaceId is required');

	const role = await getOptionalWorkspaceRole(workspaceId, user.id, minRole);
	if (!role) throw error(403, 'Forbidden');
	return { workspaceId, userId: user.id, role };
}

async function getOptionalWorkspaceRole(
	workspaceId: string | null | undefined,
	userId: string,
	minRole: WorkspaceRole
): Promise<WorkspaceRole | null> {
	if (!workspaceId) return null;

	try {
		return await requireMembership(workspaceId, userId, minRole);
	} catch {
		return null;
	}
}

export async function resolveOptionalWorkspaceContext(
	workspaceId: string | null | undefined,
	userId: string,
	minRole: WorkspaceRole = 'VIEWER'
): Promise<string | null> {
	const role = await getOptionalWorkspaceRole(workspaceId, userId, minRole);
	return role ? (workspaceId ?? null) : null;
}

export async function requireOptionalWorkspaceAccess(
	workspaceId: string | null | undefined,
	userId: string,
	minRole: WorkspaceRole = 'VIEWER',
	denialMessage = 'Access denied'
): Promise<string | null> {
	if (!workspaceId) return null;

	const role = await getOptionalWorkspaceRole(workspaceId, userId, minRole);
	if (!role) throw error(403, denialMessage);
	return workspaceId;
}

/**
 * Resolves the effective workspace (default when workspaces are disabled) then
 * enforces membership. Use for agent/chat routes that must work with ENABLE_WORKSPACES=false.
 */
export async function requireAgentRouteWorkspace(
	event: { locals: App.Locals; params: Record<string, string> },
	minRole: WorkspaceRole
): Promise<{
	workspaceId: string;
	userId: string;
	role: WorkspaceRole;
	workspaceMode: 'explicit' | 'default';
}> {
	const user = event.locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const pathId = event.params.workspaceId;
	if (!pathId) throw error(400, 'workspaceId is required');

	const { workspaceId, mode } = await resolveAgentWorkspaceForUser(user.id, pathId);
	const role = await requireMembership(workspaceId, user.id, minRole);
	return { workspaceId, userId: user.id, role, workspaceMode: mode };
}
