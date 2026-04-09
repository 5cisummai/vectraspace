import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const cookieOpts = {
	path: '/',
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict' as const
};

/** Clears the httpOnly refresh cookie. Client should remove `accessToken` from localStorage. */
export const POST: RequestHandler = async ({ cookies }) => {
	cookies.delete('refreshToken', cookieOpts);
	return json({ ok: true });
};
