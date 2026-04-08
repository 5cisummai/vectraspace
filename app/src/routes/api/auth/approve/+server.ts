import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

// POST /api/auth/approve — admin only, approves a pending user
// Body: { userId: string }
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'ADMIN') throw error(403, 'Forbidden');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { userId } = body as Record<string, unknown>;
	if (typeof userId !== 'string') throw error(400, 'userId is required');

	const user = await db.user.findUnique({ where: { id: userId } });
	if (!user) throw error(404, 'User not found');
	if (user.approved) throw error(409, 'User is already approved');

	await db.user.update({ where: { id: userId }, data: { approved: true } });

	return json({ success: true });
};

// DELETE /api/auth/approve — admin only, rejects (deletes) a pending user
// Body: { userId: string }
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (locals.user.role !== 'ADMIN') throw error(403, 'Forbidden');

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { userId } = body as Record<string, unknown>;
	if (typeof userId !== 'string') throw error(400, 'userId is required');

	// Only allow rejecting accounts that are still pending
	const user = await db.user.findUnique({ where: { id: userId } });
	if (!user) throw error(404, 'User not found');
	if (user.approved) throw error(409, 'Cannot reject an already approved user');

	await db.user.delete({ where: { id: userId } });

	return json({ success: true });
};
