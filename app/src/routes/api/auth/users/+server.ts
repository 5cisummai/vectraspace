import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

// GET /api/auth/users — admin only, returns all users with role and approval status
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'ADMIN') throw error(403, 'Forbidden');

	const users = await db.user.findMany({
		orderBy: {
			createdAt: 'desc'
		},
		select: {
			id: true,
			username: true,
			displayName: true,
			role: true,
			approved: true,
			createdAt: true
		}
	});

	return json(users);
};