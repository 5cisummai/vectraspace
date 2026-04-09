import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, locals }) => {
	const response = await fetch('/api/browse');
	const fileTree = response.ok ? await response.json() : [];

	return {
		fileTree,
		user: locals.user
	};
};
