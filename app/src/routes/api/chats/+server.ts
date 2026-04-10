import { error, json } from '@sveltejs/kit';
import {
	createChatForUser,
	listChatsForUser,
	titleFromQuestion
} from '$lib/server/chat-store';
import { getActiveBackgroundRunForChat } from '$lib/server/background-agent-runs';
import type { RequestHandler } from './$types';

interface CreateChatRequest {
	title?: string;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const chats = await listChatsForUser(locals.user.id);
	const userId = locals.user.id;

	const chatsWithStatus = chats.map((chat) => {
		const run = getActiveBackgroundRunForChat(userId, chat.id);
		const status: 'idle' | 'working' | 'done' = run
			? run.status === 'done' || run.status === 'failed'
				? 'done'
				: 'working'
			: 'idle';
		return { ...chat, status };
	});

	return json({ chats: chatsWithStatus });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = (await request.json().catch(() => null)) as CreateChatRequest | null;
	const chat = await createChatForUser(locals.user.id, titleFromQuestion(body?.title ?? ''));

	return json({ chat }, { status: 201 });
};
