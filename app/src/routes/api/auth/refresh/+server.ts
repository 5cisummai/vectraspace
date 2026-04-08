import { json, error } from '@sveltejs/kit';
import { verifyJwt, generateAccessToken } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const refreshToken = cookies.get('refreshToken');

	if (!refreshToken) {
		throw error(401, 'No refresh token');
	}

	const payload = verifyJwt(refreshToken);
	if (!payload || payload.type !== 'refresh') {
		throw error(401, 'Invalid refresh token');
	}

	const newAccessToken = generateAccessToken({
		sub: payload.sub,
		username: payload.username,
		role: payload.role
	});

	return json({ accessToken: newAccessToken });
};
