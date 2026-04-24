import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { emit } from '$lib/server/services/event-bus';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event);

	const chatId = event.params.chatId;
	if (!chatId) throw error(400, 'chatId is required');

	const chat = await db.chatSession.findFirst({
		where: { id: chatId, workspaceId },
		select: {
			id: true,
			title: true,
			userId: true,
			createdAt: true,
			updatedAt: true,
			user: {
				select: {
					username: true,
					displayName: true
				}
			}
		}
	});
	if (!chat) throw error(404, 'Chat not found in this workspace');

	const messages = await db.chatMessage.findMany({
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

	return json({
		chat: {
			id: chat.id,
			title: chat.title,
			userId: chat.userId,
			createdBy: {
				userId: chat.userId,
				username: chat.user.username,
				displayName: chat.user.displayName
			},
			createdAt: chat.createdAt.toISOString(),
			updatedAt: chat.updatedAt.toISOString()
		},
		messages: messages.map((m) => ({
			id: m.id,
			role: m.role === 'USER' ? 'user' : 'assistant',
			content: m.content,
			...(m.authorUserId !== null ? { authorUserId: m.authorUserId } : {}),
			...(m.authorDisplayName !== null ? { authorDisplayName: m.authorDisplayName } : {}),
			...(m.authorUsername !== null ? { authorUsername: m.authorUsername } : {}),
			...(m.sources !== null ? { sources: m.sources } : {}),
			...(m.toolCalls !== null ? { toolCalls: m.toolCalls } : {}),
			...(m.model !== null ? { model: m.model } : {}),
			...(m.iterations !== null ? { iterations: m.iterations } : {}),
			createdAt: m.createdAt.toISOString()
		}))
	});
};

export const DELETE: RequestHandler = async (event) => {
	const { workspaceId, userId, role } = await requireWorkspaceAccess(event, 'MEMBER');

	const chatId = event.params.chatId;
	if (!chatId) throw error(400, 'chatId is required');

	const chat = await db.chatSession.findFirst({
		where: { id: chatId, workspaceId },
		select: { id: true, userId: true }
	});
	if (!chat) throw error(404, 'Chat not found in this workspace');
	if (chat.userId !== userId && role !== 'ADMIN') {
		throw error(403, 'Only the chat creator or a workspace admin can delete this chat');
	}

	await db.chatMessage.deleteMany({ where: { chatSessionId: chatId } });
	await db.chatSession.delete({ where: { id: chatId } });
	emit(workspaceId, 'chat.deleted', {
		chatId,
		actorUserId: userId
	});

	return json({ ok: true });
};
