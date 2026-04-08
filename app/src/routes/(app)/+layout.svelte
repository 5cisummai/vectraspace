<script lang="ts">
	import type { LayoutData } from './$types';
	import AppSidebar from '$lib/components/app-sidebar.svelte';

	interface Props {
		data: LayoutData;
		children: any;
	}

	let { data, children } = $props() as Props;
</script>
{@render children()}
