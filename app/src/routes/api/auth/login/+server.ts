import { json, error } from '@sveltejs/kit';
import { findUserByUsername, verifyPassword, generateAccessToken, generateRefreshToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { username, password } = body as Record<string, unknown>;

	if (typeof username !== 'string' || typeof password !== 'string') {
		throw error(400, 'username and password are required');
	}

	const user = await findUserByUsername(username.trim().toLowerCase());

	if (!user) {
		// Constant-time stub to prevent user enumeration
		await verifyPassword(password, 'x:0'.padEnd(73, '0'));
		throw error(401, 'Invalid credentials');
	}

	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) throw error(401, 'Invalid credentials');

	if (!user.approved) {
		throw error(403, 'Account pending admin approval');
	}

	const accessToken = generateAccessToken({ sub: user.id, username: user.username, role: user.role });
	const refreshToken = generateRefreshToken({ sub: user.id, username: user.username, role: user.role });

	// Set refresh token in httpOnly cookie
	cookies.set('refreshToken', refreshToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	return json({ 
		accessToken, 
		role: user.role, 
		username: user.username, 
		displayName: user.displayName 
	});
};
