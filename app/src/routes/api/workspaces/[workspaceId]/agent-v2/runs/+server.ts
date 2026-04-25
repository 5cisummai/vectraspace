import { error } from '@sveltejs/kit';
import { runAgentV2 } from '$lib/server/agent-v2/entry';
import { mergeAgentAutoApproveToolNames } from '$lib/server/agent-settings';
import { askRequestSchema, parseBody } from '$lib/server/api';
import { db } from '$lib/server/db';
import { requireAgentRouteWorkspace } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

/**
 * Start an agent run (SSE with v2 envelopes).
 */
export const POST: RequestHandler = async (event) => {
	const { workspaceId, userId, role } = await requireAgentRouteWorkspace(event, 'MEMBER');
	const user = event.locals.user!;

	const body = await parseBody(event.request, askRequestSchema);
	const regenerate = body.regenerate === true;
	if (!regenerate && !body.question?.trim()) throw error(400, 'Question is required');

	const maxHistory =
		typeof body.maxHistoryMessages === 'number' &&
		Number.isFinite(body.maxHistoryMessages) &&
		body.maxHistoryMessages > 0
			? Math.floor(body.maxHistoryMessages)
			: undefined;

	const autoApproveToolNames = await mergeAgentAutoApproveToolNames(
		userId,
		workspaceId,
		body.autoApproveToolNames
	);
	const profile = await db.user.findUnique({
		where: { id: userId },
		select: { displayName: true, username: true }
	});

	return runAgentV2(
		body.question ?? '',
		{
		userId,
		userDisplayName: profile?.displayName ?? user.username,
		userUsername: profile?.username ?? user.username,
		isAdmin: user.role === 'ADMIN',
		workspaceRole: role,
		chatId: body.chatId,
		workspaceId,
		regenerate,
		maxHistoryMessages: maxHistory,
		autoApproveToolNames
		},
		body.filters
	);
};
