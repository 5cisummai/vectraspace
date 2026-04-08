import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Server-side auth check - redirect happens before client renders
	if (!locals.user) {
		throw redirect(302, `/login?next=${encodeURIComponent(url.pathname)}`);
	}

	return {
		user: locals.user
	};
};
