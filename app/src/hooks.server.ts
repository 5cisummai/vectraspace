import { verifyJwt, generateAccessToken } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

// Routes accessible without a valid JWT
const PUBLIC_PATHS = ['/login', '/signup', '/api/auth/login', '/api/auth/signup', '/api/auth/logout'];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Extract Bearer token from Authorization header (set by handleFetch on client)
	const authHeader = event.request.headers.get('Authorization');
	const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

	if (bearerToken) {
		const payload = verifyJwt(bearerToken);
		if (payload && payload.type !== 'refresh') {
			event.locals.user = { id: payload.sub, username: payload.username, role: payload.role };
		}
	}

	// If no access token in header but refresh token exists, try to issue a new access token
	if (!event.locals.user) {
		const refreshToken = event.cookies.get('refreshToken');
		if (refreshToken) {
			const payload = verifyJwt(refreshToken);
			if (payload && payload.type === 'refresh') {
				// Refresh token is valid, set user (client will get new access token after request setup)
				event.locals.user = { id: payload.sub, username: payload.username, role: payload.role };
			}
		}
	}

	// Allow public paths without authentication
	const isPublic = PUBLIC_PATHS.some(
		(p) => path === p || path.startsWith(p + '/')
	);

	if (!isPublic && !event.locals.user) {
		// API routes get a 401 JSON response; page routes get a redirect
		if (path.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(null, {
			status: 302,
			headers: { Location: `/login?next=${encodeURIComponent(path)}` }
		});
	}

	return resolve(event);
};
