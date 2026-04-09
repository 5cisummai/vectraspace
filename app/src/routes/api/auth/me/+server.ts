import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const user = await db.user.findUnique({
		where: { id: locals.user.id },
		select: {
			id: true,
			username: true,
			displayName: true,
			role: true,
			approved: true
		}
	});

	if (!user) throw error(404, 'User not found');

	return json(user);
};