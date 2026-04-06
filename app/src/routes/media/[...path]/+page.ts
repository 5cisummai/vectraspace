import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const path = params.path ?? '';
	return { path };
};