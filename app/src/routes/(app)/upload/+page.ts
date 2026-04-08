import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	return { dest: url.searchParams.get('dest') ?? '' };
};