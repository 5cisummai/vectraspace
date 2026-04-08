import { json, error } from '@sveltejs/kit';
import { createUser, generateAccessToken, generateRefreshToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { username, displayName, password } = body as Record<string, unknown>;

	if (typeof username !== 'string' || username.trim().length < 3) {
		throw error(400, 'Username must be at least 3 characters');
	}
	if (typeof displayName !== 'string' || displayName.trim().length < 1) {
		throw error(400, 'Display name is required');
	}
	if (typeof password !== 'string'){
		throw error(400, 'Password is required');
	};
	if (password.length < 8) {
		throw error(400, 'Password must be at least 8 characters');
	}

	try {
		const user = await createUser({
			username: username.trim().toLowerCase(),
			displayName: displayName.trim(),
			password: password.trim()
		});

		// If user is auto-approved (first user), generate tokens
		if (user.approved) {
			const accessToken = generateAccessToken({ sub: user.id, username: user.username, role: user.role });
			const refreshToken = generateRefreshToken({ sub: user.id, username: user.username, role: user.role });

			cookies.set('refreshToken', refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				path: '/',
				maxAge: 60 * 60 * 24 * 7 // 7 days
			});

			return json({
				id: user.id,
				username: user.username,
				approved: user.approved,
				role: user.role,
				accessToken
			});
		}

		return json({
			id: user.id,
			username: user.username,
			approved: user.approved,
			role: user.role
		});
	} catch (e) {
		// Unique constraint violation (duplicate username)
		if (e instanceof Error && e.message.includes('Unique constraint')) {
			throw error(409, 'Username already taken');
		}
		throw e;
	}
};
