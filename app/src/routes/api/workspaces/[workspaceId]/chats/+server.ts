import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getActiveRunForChat } from '$lib/server/agent-runs';
import { requireWorkspaceAccess } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { workspaceId } = await requireWorkspaceAccess(event);

	const chats = await db.chatSession.findMany({
		where: { workspaceId },
		orderBy: { updatedAt: 'desc' },
		take: 100,
		select: {
			id: true,
			title: true,
			userId: true,
			createdAt: true,
			updatedAt: true,
			_count: { select: { messages: true } }
		}
	});

	const chatsWithStatus = await Promise.all(
		chats.map(async (chat) => {
			const run = await getActiveRunForChat(chat.id);
			const status: 'idle' | 'working' | 'done' = run
				? run.status === 'DONE' || run.status === 'FAILED'
					? 'done'
					: 'working'
				: 'idle';
			return {
				id: chat.id,
				title: chat.title,
				userId: chat.userId,
				createdAt: chat.createdAt.toISOString(),
				updatedAt: chat.updatedAt.toISOString(),
				messageCount: chat._count.messages,
				status
			};
		})
	);

	return json({ chats: chatsWithStatus });
};

interface CreateChatBody {
	title?: string;
}

export const POST: RequestHandler = async (event) => {
	const { workspaceId, userId } = await requireWorkspaceAccess(event, 'MEMBER');

	const body = (await event.request.json().catch(() => null)) as CreateChatBody | null;
	const title = body?.title?.trim() || 'New chat';

	const chat = await db.chatSession.create({
		data: {
			userId,
			workspaceId,
			title
		},
		select: {
			id: true,
			title: true,
			createdAt: true,
			updatedAt: true
		}
	});

	return json(
		{
			chat: {
				id: chat.id,
				title: chat.title,
				createdAt: chat.createdAt.toISOString(),
				updatedAt: chat.updatedAt.toISOString(),
				messageCount: 0
			}
		},
		{ status: 201 }
	);
};
