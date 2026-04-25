import { confirmToolV2 } from '$lib/server/agent-v2/entry';
import { mergeAgentAutoApproveToolNames } from '$lib/server/agent-settings';
import { confirmToolSchema, parseBody } from '$lib/server/api';
import { requireAgentRouteWorkspace } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

/**
 * Continue a pending run after a tool confirmation decision.
 */
export const POST: RequestHandler = async (event) => {
	const { workspaceId, userId, role } = await requireAgentRouteWorkspace(event, 'MEMBER');
	const user = event.locals.user!;

	const body = await parseBody(event.request, confirmToolSchema);

	const autoApproveToolNames = await mergeAgentAutoApproveToolNames(
		userId,
		workspaceId,
		body.autoApproveToolNames
	);

	return confirmToolV2({
		userId,
		isAdmin: user.role === 'ADMIN',
		workspaceRole: role,
		pendingId: body.pendingId,
		approved: body.approved,
		chatId: body.chatId,
		workspaceId,
		autoApproveToolNames
	});
};
