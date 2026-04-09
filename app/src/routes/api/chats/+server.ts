import { error, json } from '@sveltejs/kit';
import {
	createChatForUser,
	listChatsForUser,
	titleFromQuestion
} from '$lib/server/chat-store';
import type { RequestHandler } from './$types';

interface CreateChatRequest {
	title?: string;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const chats = await listChatsForUser(locals.user.id);
	return json({ chats });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = (await request.json().catch(() => null)) as CreateChatRequest | null;
	const chat = await createChatForUser(locals.user.id, titleFromQuestion(body?.title ?? ''));

	return json({ chat }, { status: 201 });
};
