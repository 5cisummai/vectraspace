import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Legacy URLs used `?file=` on /browse; send them to the media route. */
export const load: PageLoad = ({ url }) => {
	const file = url.searchParams.get('file');
	if (!file) return;

	const next = new URLSearchParams();
	next.set('file', file);
	const path = url.searchParams.get('path');
	if (path) next.set('path', path);

	throw redirect(302, `/browse/media?${next.toString()}`);
};
