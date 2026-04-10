import { error, json } from '@sveltejs/kit';
import { getActiveRunForChat, toApiStatus } from '$lib/server/agent-runs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const chatId = url.searchParams.get('chatId')?.trim();
	if (!chatId) throw error(400, 'chatId is required');

	const run = await getActiveRunForChat(chatId, locals.user.id);
	if (!run) {
		return json({ run: null });
	}

	return json({
		run: {
			id: run.id,
			chatId: run.chatId,
			kind: run.kind,
			status: toApiStatus(run.status),
			error: run.error ?? null,
			pendingToolConfirmation: run.pendingToolConfirmation ?? null,
			toolStreamLog: run.toolStreamLog ?? [],
			createdAt: run.createdAt,
			updatedAt: run.updatedAt
		}
	});
};
