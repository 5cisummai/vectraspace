import type { HandleFetch } from '@sveltejs/kit';

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	// Attach stored access token to all same-origin API requests
	if (typeof localStorage !== 'undefined') {
		const accessToken = localStorage.getItem('accessToken');
		if (accessToken && new URL(request.url).origin === location.origin) {
			request = new Request(request, {
				headers: new Headers({ ...Object.fromEntries(request.headers), Authorization: `Bearer ${accessToken}` })
			});
		}
	}
	return fetch(request);
};
