import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

// GET /api/auth/pending — admin only, returns list of unapproved users
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'ADMIN') throw error(403, 'Forbidden');

	const pending = await db.user.findMany({
		where: { approved: false },
		select: { id: true, username: true, displayName: true, createdAt: true }
	});

	return json(pending);
};
