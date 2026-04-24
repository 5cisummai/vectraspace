import { confirmTool } from '$lib/server/agent';
import { mergeAgentAutoApproveToolNames } from '$lib/server/agent-settings';
import { confirmToolSchema, parseBody } from '$lib/server/api';
import { requireAgentRouteWorkspace } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

/**
 * V2: same as `POST /brain/ask/confirm` (SSE resume with v2 envelopes when USE_AGENT_V2 is on).
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

	return confirmTool({
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
