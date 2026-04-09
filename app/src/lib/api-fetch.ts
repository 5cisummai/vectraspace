import { browser } from '$app/environment';

/**
 * Same-origin API fetch with `Authorization: Bearer` when `accessToken` is in
 * localStorage (matches `hooks.client.ts` handleFetch behavior for load `fetch`).
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const headers = new Headers(init?.headers);
	if (browser) {
		const token = localStorage.getItem('accessToken');
		if (token) headers.set('Authorization', `Bearer ${token}`);
	}
	return fetch(input, { ...init, headers });
}
