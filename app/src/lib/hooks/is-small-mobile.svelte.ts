import { MediaQuery } from 'svelte/reactivity';

/**
 * Small-phone breakpoint for extra narrow devices (e.g. ~480px and below).
 * Default is 480px to separate compact phones from larger mobile screens.
 */
const DEFAULT_SMALL_MOBILE_BREAKPOINT = 480;

export class IsSmallMobile extends MediaQuery {
	constructor(breakpoint: number = DEFAULT_SMALL_MOBILE_BREAKPOINT) {
		super(`max-width: ${breakpoint}px`);
	}
}
