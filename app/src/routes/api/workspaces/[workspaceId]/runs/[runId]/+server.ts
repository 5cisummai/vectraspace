import { error, json } from '@sveltejs/kit';
import { getAgentRunForWorkspace, toApiStatus } from '$lib/server/agent-runs';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event);

	const runId = event.params.runId;
	if (!runId) throw error(400, 'runId is required');

	const run = await getAgentRunForWorkspace(workspaceId, runId);
	if (!run) throw error(404, 'Run not found');

	return json({
		id: run.id,
		chatId: run.chatId,
		userId: run.userId,
		userDisplayName: run.userDisplayName ?? null,
		userUsername: run.userUsername ?? null,
		status: toApiStatus(run.status),
		error: run.error ?? null,
		pendingToolConfirmation: run.pendingToolConfirmation
			? {
					...run.pendingToolConfirmation,
					requestedByUserId: run.userId,
					requestedByDisplayName: run.userDisplayName ?? run.userUsername ?? null
				}
			: null,
		toolStreamLog: run.toolStreamLog ?? [],
		steps: run.steps ?? [],
		createdAt: run.createdAt,
		updatedAt: run.updatedAt
	});
};
