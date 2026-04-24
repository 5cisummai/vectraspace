// ---------------------------------------------------------------------------
// runAgentV2 / confirmToolV2 — public server API (OpenAI Agents SDK + V2 SSE)
// ---------------------------------------------------------------------------

import { error } from '@sveltejs/kit';
import { RunState } from '@openai/agents';
import type { AgentRunConfig, ConfirmRunConfig, AskFilters } from '$lib/server/agent/types';
import { createAppContext, type AgentAppContext } from '$lib/server/agent/context';
import { AgentLogger } from '$lib/server/agent/logger';
import { normalizeFilters } from '$lib/server/agent/filters';
import { prepareAgentRun } from '$lib/server/agent/run-prepare';
import { getMediaAgent } from '$lib/server/agent/agent';
import { configureAgentProvider } from '$lib/server/agent/provider';
import { takePendingConfirmation } from '$lib/server/pending-tool-confirmation';
import { createV2ConfirmStreamingResponse, createV2StreamingResponse } from './transport-sse';

configureAgentProvider();

function makeContext(
	config: {
		userId: string;
		isAdmin: boolean;
		chatId: string;
		workspaceId?: string;
		autoApproveToolNames?: string[];
	},
	logger: AgentLogger,
	filters?: AskFilters
): AgentAppContext {
	return createAppContext({
		userId: config.userId,
		chatId: config.chatId,
		isAdmin: config.isAdmin,
		workspaceId: config.workspaceId,
		filters: normalizeFilters(filters),
		autoApproveToolNames: config.autoApproveToolNames,
		logger
	});
}

export async function runAgentV2(
	question: string,
	config: AgentRunConfig,
	filters?: AskFilters
): Promise<Response> {
	const { chatId, bodyForAgent, savedUserMessageId } = await prepareAgentRun(question, config, filters);
	const ctx = makeContext(
		{
			userId: config.userId,
			isAdmin: config.isAdmin,
			chatId,
			workspaceId: config.workspaceId,
			autoApproveToolNames: config.autoApproveToolNames
		},
		new AgentLogger(),
		filters
	);

	return createV2StreamingResponse(bodyForAgent, ctx, {
		chatId,
		kind: 'ask',
		savedUserMessageId,
		workspaceId: config.workspaceId!
	});
}

export async function confirmToolV2(config: ConfirmRunConfig): Promise<Response> {
	if (!config.workspaceId?.trim()) {
		throw error(400, 'workspaceId is required');
	}

	const logger = new AgentLogger();
	const taken = await takePendingConfirmation(config.userId, config.pendingId);
	if (!taken) throw error(404, 'Confirmation expired or not found');
	if (config.chatId && config.chatId !== taken.chatSessionId) throw error(400, 'Chat mismatch');

	const { payload } = taken;
	const chatId = taken.chatSessionId;
	const agent = getMediaAgent();
	const runState = await RunState.fromString(agent, payload.runState);
	const interruptions = runState.getInterruptions();
	if (interruptions.length > 0) {
		const interruption = interruptions[0];
		if (config.approved) {
			runState.approve(interruption);
		} else {
			runState.reject(interruption, {
				message:
					'User declined this action. Acknowledge briefly and offer alternatives (or ask what they would like instead). Do not call the same destructive tool again unless the user clearly asks.'
			});
		}
	}

	const ctx = makeContext(
		{
			userId: config.userId,
			isAdmin: config.isAdmin,
			chatId,
			workspaceId: config.workspaceId,
			autoApproveToolNames: config.autoApproveToolNames
		},
		logger
	);

	return createV2ConfirmStreamingResponse(runState, ctx, {
		chatId,
		kind: 'confirm',
		workspaceId: config.workspaceId
	});
}
