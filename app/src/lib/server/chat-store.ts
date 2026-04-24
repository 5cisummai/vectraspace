import { randomInt } from 'node:crypto';
import { db } from '$lib/server/db';
import type { Prisma, WorkspaceRole } from '@prisma/client';
import type { ConversationMessage, StoredChatMessage } from '$lib/server/agent/types';
import { getActiveRunForChat } from '$lib/server/agent-runs';
import { emit as emitWorkspaceEvent } from '$lib/server/services/event-bus';
import { summarizePromptAsChatTitle } from '$lib/server/services/llm';
import { dedupeChatsById } from '$lib/utils.js';

const UNTITLED_CHAT = 'New chat';
const MAX_TITLE_LENGTH = 120;

type ChatMessageRow = {
	id: string;
	role: 'USER' | 'ASSISTANT';
	content: string;
	authorUserId: string | null;
	authorDisplayName: string | null;
	authorUsername: string | null;
	sources: Prisma.JsonValue | null;
	toolCalls: Prisma.JsonValue | null;
	model: string | null;
	iterations: number | null;
	createdAt: Date;
};

type WorkspaceChatSessionRow = {
	id: string;
	title: string;
	userId: string;
	workspaceId: string | null;
};

export type ChatSummary = {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	messageCount: number;
};

export type ChatStatus = 'idle' | 'working' | 'done';
export type ChatSummaryWithStatus = ChatSummary & { status: ChatStatus };

export type { StoredChatMessage } from '$lib/server/agent/types';

export type ChatMessageAuthor = {
	userId: string;
	displayName: string;
	username: string;
};

type ChatMessageMeta = {
	sources?: unknown;
	toolCalls?: unknown;
	model?: string;
	iterations?: number;
};

type DeleteMessagesInput = {
	userId: string;
	userRole: WorkspaceRole;
	chatId: string;
	fromMessageId: string;
	workspaceId?: string | null;
};

function sanitizeTitle(title: string): string {
	return title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function canModerateWorkspaceChat(role: WorkspaceRole): boolean {
	return role === 'ADMIN';
}

async function getChatSession(
	chatId: string,
	workspaceId?: string | null
): Promise<WorkspaceChatSessionRow | null> {
	const where =
		workspaceId !== undefined && workspaceId !== null
			? { id: chatId, workspaceId }
			: { id: chatId };

	return db.chatSession.findFirst({
		where,
		select: {
			id: true,
			title: true,
			userId: true,
			workspaceId: true
		}
	});
}

function emitChatEvent(
	workspaceId: string | null | undefined,
	type: string,
	data: Record<string, unknown>
): void {
	if (!workspaceId) return;
	emitWorkspaceEvent(workspaceId, type, data);
}

/** Short word lists for human-readable session names (not derived from the first prompt). */
const CHAT_TITLE_ADJECTIVES = [
	'Quiet',
	'Calm',
	'Bright',
	'Gentle',
	'Swift',
	'Clear',
	'Soft',
	'Bold',
	'Cool',
	'Warm',
	'Deep',
	'Light',
	'Fresh',
	'Keen',
	'Fine',
	'Grand',
	'Noble',
	'Quick',
	'Steady',
	'Wild',
	'Azure',
	'Cedar',
	'Crimson',
	'Golden',
	'Jade',
	'Silver',
	'Velvet',
	'Winter',
	'Summer',
	'Morning',
	'Evening'
] as const;

const CHAT_TITLE_NOUNS = [
	'Harbor',
	'Meadow',
	'Canvas',
	'Beacon',
	'Compass',
	'Anchor',
	'Current',
	'Drift',
	'Fjord',
	'Glacier',
	'Horizon',
	'Island',
	'Lagoon',
	'Mirror',
	'Orchard',
	'Pinnacle',
	'Quartz',
	'Ridge',
	'Summit',
	'Tide',
	'Voyage',
	'Willow',
	'Zephyr',
	'Atlas',
	'Birch',
	'Cove',
	'Dune',
	'Eagle',
	'Falcon',
	'Garden'
] as const;

export function generateChatTitle(): string {
	const adj = CHAT_TITLE_ADJECTIVES[randomInt(CHAT_TITLE_ADJECTIVES.length)];
	const noun = CHAT_TITLE_NOUNS[randomInt(CHAT_TITLE_NOUNS.length)];
	return sanitizeTitle(`${adj} ${noun}`);
}

export function titleForNewChat(explicitTitle?: string | null): string {
	const normalized = sanitizeTitle(explicitTitle ?? '');
	if (normalized) return normalized;
	return generateChatTitle();
}

function normalizeLlmChatTitle(raw: string): string {
	const firstLine = raw.split('\n')[0] ?? raw;
	let t = sanitizeTitle(firstLine.replace(/\s+/g, ' '));
	t = t.replace(/^["'«»\u201c\u201d]+|["'«»\u201c\u201d]+$/g, '').trim();
	return sanitizeTitle(t);
}

async function titleFromFirstUserMessage(firstMessage: string): Promise<string> {
	try {
		const raw = await summarizePromptAsChatTitle(firstMessage);
		const t = normalizeLlmChatTitle(raw);
		if (t) return t;
	} catch {
		// fall back below
	}
	return generateChatTitle();
}

function toStoredMessage(row: ChatMessageRow): StoredChatMessage {
	return {
		id: row.id,
		role: row.role === 'USER' ? 'user' : 'assistant',
		content: row.content,
		authorUserId: row.authorUserId,
		authorDisplayName: row.authorDisplayName,
		authorUsername: row.authorUsername,
		...(row.sources !== null ? { sources: row.sources } : {}),
		...(row.toolCalls !== null ? { toolCalls: row.toolCalls } : {}),
		...(row.model !== null ? { model: row.model } : {}),
		...(row.iterations !== null ? { iterations: row.iterations } : {}),
		createdAt: row.createdAt.toISOString()
	};
}

export function messagesToLlmHistory(messages: StoredChatMessage[]): ConversationMessage[] {
	return messages.map((message) => ({
		role: message.role,
		content: message.content
	}));
}

export async function withChatStatuses<T extends { id: string }>(
	items: T[],
	userId?: string
): Promise<Array<T & { status: ChatStatus }>> {
	const itemsWithStatus = await Promise.all(
		items.map(async (item) => {
			const run = await getActiveRunForChat(item.id, userId);
			const status: ChatStatus = run
				? run.status === 'DONE' || run.status === 'FAILED'
					? 'done'
					: 'working'
				: 'idle';

			return { ...item, status };
		})
	);

	return dedupeChatsById(itemsWithStatus);
}

export async function createChatForUser(
	userId: string,
	title: string,
	workspaceId?: string | null
): Promise<ChatSummary> {
	const row = await db.chatSession.create({
		data: {
			userId,
			title: sanitizeTitle(title) || UNTITLED_CHAT,
			...(workspaceId ? { workspaceId } : {})
		},
		select: {
			id: true,
			title: true,
			createdAt: true,
			updatedAt: true
		}
	});

	emitChatEvent(workspaceId, 'chat.created', {
		chatId: row.id,
		title: row.title,
		createdByUserId: userId
	});

	return {
		id: row.id,
		title: row.title,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		messageCount: 0
	};
}

export async function ensureWorkspaceChatSession(
	chatId: string,
	workspaceId?: string | null
): Promise<WorkspaceChatSessionRow> {
	const row = await getChatSession(chatId, workspaceId);
	if (!row) {
		throw new Error('Chat not found');
	}
	return row;
}

export async function ensureOwnedChatSession(
	userId: string,
	chatId: string,
	workspaceId?: string | null
): Promise<{ id: string; title: string }> {
	const row = await ensureWorkspaceChatSession(chatId, workspaceId);
	if (row.userId !== userId) {
		throw new Error('Chat not found');
	}
	return { id: row.id, title: row.title };
}

export async function getChatMessagesForWorkspace(
	chatId: string,
	workspaceId?: string | null
): Promise<StoredChatMessage[]> {
	await ensureWorkspaceChatSession(chatId, workspaceId);

	const rows = await db.chatMessage.findMany({
		where: { chatSessionId: chatId },
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			role: true,
			content: true,
			authorUserId: true,
			authorDisplayName: true,
			authorUsername: true,
			sources: true,
			toolCalls: true,
			model: true,
			iterations: true,
			createdAt: true
		}
	});

	return rows.map(toStoredMessage);
}

export async function saveUserMessage(
	chatId: string,
	content: string,
	author: ChatMessageAuthor,
	workspaceId?: string | null
): Promise<string | null> {
	const trimmed = content.trim();
	if (!trimmed) return null;

	const row = await db.chatMessage.create({
		data: {
			chatSessionId: chatId,
			role: 'USER',
			content: trimmed,
			authorUserId: author.userId,
			authorDisplayName: author.displayName,
			authorUsername: author.username
		},
		select: { id: true }
	});

	await db.chatSession.update({
		where: { id: chatId },
		data: { updatedAt: new Date() }
	});

	emitChatEvent(workspaceId, 'chat.message', {
		chatId,
		messageId: row.id,
		role: 'user',
		authorUserId: author.userId,
		authorDisplayName: author.displayName,
		authorUsername: author.username
	});

	return row.id;
}

export async function saveAssistantMessage(
	chatId: string,
	content: string,
	meta?: ChatMessageMeta,
	workspaceId?: string | null
): Promise<string | null> {
	const trimmed = content.trim();
	if (!trimmed) return null;

	const row = await db.chatMessage.create({
		data: {
			chatSessionId: chatId,
			role: 'ASSISTANT',
			content: trimmed,
			sources: meta?.sources as Prisma.InputJsonValue | undefined,
			toolCalls: meta?.toolCalls as Prisma.InputJsonValue | undefined,
			model: meta?.model,
			iterations: meta?.iterations
		},
		select: { id: true }
	});

	await db.chatSession.update({
		where: { id: chatId },
		data: { updatedAt: new Date() }
	});

	emitChatEvent(workspaceId, 'chat.message', {
		chatId,
		messageId: row.id,
		role: 'assistant'
	});

	return row.id;
}

export async function deleteMessagesFromMessageId(input: DeleteMessagesInput): Promise<void> {
	const chat = await ensureWorkspaceChatSession(input.chatId, input.workspaceId);

	const rows = await db.chatMessage.findMany({
		where: { chatSessionId: input.chatId },
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			role: true,
			authorUserId: true
		}
	});

	const idx = rows.findIndex((row) => row.id === input.fromMessageId);
	if (idx === -1) {
		throw new Error('Message not found');
	}

	const actorCanModerate = canModerateWorkspaceChat(input.userRole);
	const anchor = rows[idx];
	if (!anchor) {
		throw new Error('Message not found');
	}

	const editableByUserId =
		anchor.role === 'USER'
			? anchor.authorUserId
			: (() => {
		const precedingUser = [...rows.slice(0, idx)].reverse().find((row) => row.role === 'USER');
				if (!precedingUser) {
					throw new Error('Message not editable');
				}
				return precedingUser.authorUserId;
			})();

	if (!actorCanModerate && editableByUserId !== input.userId) {
		throw new Error('Forbidden');
	}

	const ids = rows.slice(idx).map((row) => row.id);
	if (ids.length === 0) return;

	await db.chatMessage.deleteMany({
		where: { id: { in: ids } }
	});

	await db.chatSession.update({
		where: { id: input.chatId },
		data: { updatedAt: new Date() }
	});

	emitChatEvent(chat.workspaceId, 'chat.truncated', {
		chatId: input.chatId,
		fromMessageId: input.fromMessageId,
		deletedMessageIds: ids,
		actorUserId: input.userId
	});
}

export async function resolveOrCreateChat(
	userId: string,
	chatId: string | undefined,
	firstMessage: string,
	workspaceId?: string | null
): Promise<ChatSummary> {
	if (chatId) {
		const row = await ensureWorkspaceChatSession(chatId, workspaceId);
		const found = await db.chatSession.findUniqueOrThrow({
			where: { id: row.id },
			select: {
				id: true,
				title: true,
				createdAt: true,
				updatedAt: true,
				_count: { select: { messages: true } }
			}
		});
		return {
			id: found.id,
			title: found.title,
			createdAt: found.createdAt.toISOString(),
			updatedAt: found.updatedAt.toISOString(),
			messageCount: found._count.messages
		};
	}

	const title = await titleFromFirstUserMessage(firstMessage);
	return createChatForUser(userId, title, workspaceId);
}
