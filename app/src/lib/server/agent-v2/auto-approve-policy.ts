import { mergeAgentAutoApproveToolNames } from '$lib/server/agent-settings';
import { shouldAutoApproveTool } from './auto-approve-tools';

/**
 * Auto-approve tool names the server will honor for this run.
 * `mergeAgentAutoApproveToolNames` already applies stored user/workspace prefs
 * and `normalizeAutoApproveToolNames` in settings drops anything outside
 * the server allowlist — clients cannot widen past safe mutation tools.
 */
export async function resolveAutoApproveForRun(
	userId: string,
	workspaceId: string,
	requestNames: unknown
): Promise<string[]> {
	return mergeAgentAutoApproveToolNames(userId, workspaceId, requestNames);
}

export { shouldAutoApproveTool };
