import { error } from '@sveltejs/kit';
import type { AgentRequest, AgentRunConfig, AskFilters } from './types';
import { sliceHistory } from './memory/history';
import {
	resolveOrCreateChat,
	ensureWorkspaceChatSession,
	getChatMessagesForWorkspace,
	saveUserMessage
} from '$lib/server/chat-store';
import { getActiveRunForChat } from '$lib/server/agent-runs';

export type PreparedAgentRun = {
	chatId: string;
	bodyForAgent: AgentRequest;
	savedUserMessageId: string | null;
};

async function assertNoConcurrentRun(targetChatId: string): Promise<void> {
	const activeRun = await getActiveRunForChat(targetChatId);
	if (!activeRun) return;
	const actorLabel =
		activeRun.userDisplayName || activeRun.userUsername || 'Another workspace member';
	throw error(
		409,
		`${actorLabel} is already running this chat. Wait for that run to finish before sending another request.`
	);
}

export async function prepareAgentRun(
	question: string,
	config: AgentRunConfig,
	filters?: AskFilters
): Promise<PreparedAgentRun> {
	if (!config.workspaceId?.trim()) {
		throw error(400, 'workspaceId is required');
	}
	let chatId: string;
	let bodyForAgent: AgentRequest;
	let savedUserMessageId: string | null = null;

	if (config.regenerate) {
		if (!config.chatId?.trim()) throw error(400, 'chatId is required when regenerate is true');
		try {
			await ensureWorkspaceChatSession(config.chatId, config.workspaceId);
		} catch {
			throw error(404, 'Chat not found');
		}
		chatId = config.chatId;
		await assertNoConcurrentRun(chatId);
		const previousMessages = await getChatMessagesForWorkspace(chatId, config.workspaceId);
		if (previousMessages.length === 0) throw error(400, 'No messages to regenerate from');
		const last = previousMessages[previousMessages.length - 1];
		if (last.role !== 'user') throw error(400, 'Last message must be a user message to regenerate');
		if (last.authorUserId !== config.userId && config.workspaceRole !== 'ADMIN') {
			throw error(403, 'You can only regenerate replies to your own prompt');
		}
		const history = sliceHistory(previousMessages.slice(0, -1), config.maxHistoryMessages);
		bodyForAgent = {
			question: last.content,
			history,
			filters,
			autoApproveToolNames: config.autoApproveToolNames
		};
	} else {
		const chat = await resolveOrCreateChat(
			config.userId,
			config.chatId,
			question,
			config.workspaceId
		).catch(() => {
			throw error(404, 'Chat not found');
		});
		chatId = chat.id;
		if (config.chatId) {
			await assertNoConcurrentRun(chatId);
		}
		const previousMessages = await getChatMessagesForWorkspace(chatId, config.workspaceId);
		const history = sliceHistory(previousMessages, config.maxHistoryMessages);
		savedUserMessageId = await saveUserMessage(
			chatId,
			question,
			{
				userId: config.userId,
				displayName: config.userDisplayName,
				username: config.userUsername
			},
			config.workspaceId
		);
		bodyForAgent = {
			question,
			history,
			filters,
			autoApproveToolNames: config.autoApproveToolNames
		};
	}

	return { chatId, bodyForAgent, savedUserMessageId };
}
