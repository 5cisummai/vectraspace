<script lang="ts">
	import { workspaceStore } from '$lib/hooks/workspace.svelte';
	import { apiFetch } from '$lib/api-fetch';
	import { Button } from '$lib/components/ui/button';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	type Density = 'compact' | 'comfortable';

	interface Props {
		isAdmin: boolean;
		/** compact = outline + sm (e.g. search header); comfortable = default button (settings) */
		density?: Density;
		/** Fires when a reindex starts or finishes so parents can disable other actions */
		onBusyChange?: (busy: boolean) => void;
	}

	let { isAdmin, density = 'compact', onBusyChange }: Props = $props();

	let reindexing = $state(false);
	let reindexMessage = $state<string | null>(null);
	let messageIsError = $state(false);

	const workspaceId = $derived(workspaceStore.activeId);
	const workspaceMissing = $derived(!workspaceId);

	async function rebuildSemanticIndex() {
		if (!workspaceId || reindexing) return;
		reindexing = true;
		onBusyChange?.(true);
		reindexMessage = null;
		messageIsError = false;
		try {
			const res = await apiFetch(
				`/api/workspaces/${encodeURIComponent(workspaceId)}/search/reindex`,
				{ method: 'POST' }
			);
			const data = (await res.json().catch(() => null)) as {
				summary?: { indexed?: number; totalFiles?: number };
				message?: string;
			} | null;
			if (res.ok && data?.summary) {
				reindexMessage = `Indexed ${data.summary.indexed ?? 0} of ${data.summary.totalFiles ?? 0} files.`;
				messageIsError = false;
			} else {
				let fallback = 'Reindex failed';
				if (res.status === 403) fallback = 'Admins only.';
				reindexMessage = data?.message ?? fallback;
				messageIsError = true;
			}
		} catch (e) {
			reindexMessage = e instanceof Error ? e.message : 'Reindex failed';
			messageIsError = true;
		} finally {
			reindexing = false;
			onBusyChange?.(false);
		}
	}
</script>

{#if isAdmin}
	<div
		class={density === 'compact'
			? 'flex flex-wrap items-center gap-3'
			: 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'}
	>
		<Button
			type="button"
			variant={density === 'compact' ? 'outline' : 'default'}
			size={density === 'compact' ? 'sm' : 'default'}
			class="gap-2"
			disabled={reindexing || workspaceMissing}
			onclick={rebuildSemanticIndex}
		>
			{#if reindexing}
				<LoaderCircleIcon class="size-4 animate-spin" aria-hidden="true" />
			{:else}
				<RefreshCwIcon class="size-4" aria-hidden="true" />
			{/if}
			{reindexing ? 'Reindexing…' : 'Rebuild semantic index'}
		</Button>
		{#if workspaceMissing}
			<span class="text-xs text-muted-foreground">
				Select a workspace in the header to rebuild that workspace’s search index.
			</span>
		{:else if reindexMessage}
			<span
				class="text-xs {messageIsError ? 'text-destructive' : 'text-muted-foreground'}"
				role={messageIsError ? 'alert' : 'status'}
			>
				{reindexMessage}
			</span>
		{/if}
	</div>
{/if}
