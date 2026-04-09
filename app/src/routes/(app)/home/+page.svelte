<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FileEntry } from '$lib/components/file-browser/file-grid.svelte';

	type BrowseNode = {
		name?: string;
		title?: string;
		path?: string;
		type?: 'file' | 'directory' | 'folder';
		children?: BrowseNode[];
	};

	const fileTree = $derived(($page.data.fileTree ?? []) as BrowseNode[]);

	function toFileEntries(nodes: BrowseNode[]): FileEntry[] {
		return nodes.map((node, index) => {
			const name = node.name ?? node.title ?? `Item ${index + 1}`;
			const path = node.path ?? name;
			const isDirectory = node.type === 'directory' || node.type === 'folder' || !!node.children?.length;
			return {
				id: path,
				name,
				path,
				type: isDirectory ? 'directory' : 'file',
				children: node.children ? toFileEntries(node.children) : []
			};
		});
	}

	const browserTree = $derived(toFileEntries(fileTree));

	function flattenEntries(entries: FileEntry[]): FileEntry[] {
		return entries.flatMap((entry) => [entry, ...(entry.children ? flattenEntries(entry.children) : [])]);
	}

	const allEntries = $derived(flattenEntries(browserTree));
	const imageFiles = $derived(
		allEntries.filter(
			(entry) =>
				entry.type === 'file' &&
				/\.(png|jpe?g|webp|gif|bmp|tiff|svg)$/i.test(entry.path ?? entry.name)
		)
	);
	const documentFiles = $derived(
		allEntries.filter(
			(entry) =>
				entry.type === 'file' &&
				/\.(pdf|md|txt|docx?|xlsx?|pptx?)$/i.test(entry.path ?? entry.name)
		)
	);

	function goToBrowse() {
		goto(resolve('/(app)/browse'));
	}

	function goToUpload() {
		goto(resolve('/demo'));
	}
</script>

<div class="min-h-full bg-background text-foreground p-4 sm:p-6">
	<main class="mx-auto flex w-full max-w-360 flex-col gap-8">
		<section class="flex flex-col gap-2">
			<p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Media Server</p>
			<h1 class="text-2xl font-semibold">Home</h1>
			<p class="max-w-2xl text-sm text-muted-foreground">
				Quickly jump into your media workspace. Images and documents from your index are surfaced here.
			</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<button
					type="button"
					class="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
					onclick={goToBrowse}
				>
					Open browser
				</button>
				<button
					type="button"
					class="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
					onclick={goToUpload}
				>
					Open demo
				</button>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-sm font-semibold">Images</h2>
			{#if imageFiles.length === 0}
				<p class="text-sm text-muted-foreground">No images found in your current index.</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{#each imageFiles.slice(0, 12) as entry (entry.path)}
						<li
							class="flex flex-col rounded-md border border-border bg-card px-3 py-2 text-sm"
							title={entry.path}
						>
							<span class="truncate font-medium">{entry.name}</span>
							<span class="truncate font-mono text-[11px] text-muted-foreground">
								{entry.path}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="space-y-3">
			<h2 class="text-sm font-semibold">Documents</h2>
			{#if documentFiles.length === 0}
				<p class="text-sm text-muted-foreground">No documents found in your current index.</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{#each documentFiles.slice(0, 12) as entry (entry.path)}
						<li
							class="flex flex-col rounded-md border border-border bg-card px-3 py-2 text-sm"
							title={entry.path}
						>
							<span class="truncate font-medium">{entry.name}</span>
							<span class="truncate font-mono text-[11px] text-muted-foreground">
								{entry.path}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>