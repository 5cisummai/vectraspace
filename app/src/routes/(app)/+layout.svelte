<script lang="ts">
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: any;
	}

	let { data, children } = $props() as Props;
</script>


{@render children()}
