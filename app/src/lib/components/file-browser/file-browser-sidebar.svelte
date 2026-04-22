<script lang="ts">
	import { page } from '$app/stores';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FileTree from '$lib/components/file-browser/file-tree.svelte';
	import { createEventDispatcher } from 'svelte';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { mediaTrashBrowsePath } from '$lib/components/file-browser/media-trash-path';
	import type { FileEntry } from '$lib/components/file-browser/file-grid.svelte';
	import type { FileTreeNode } from '$lib/components/file-browser/file-tree.svelte';

	const dispatch = createEventDispatcher<{
		select: { path: string; kind: 'file' | 'directory' };
	}>();

	let {
		activePath = null,
		tree = null,
		folderChildrenLoader,
		mergeFolderChildren
	}: {
		activePath?: string | null;
		tree?: FileEntry[] | null;
		folderChildrenLoader?: (path: string) => Promise<FileTreeNode[]>;
		mergeFolderChildren?: (path: string, children: FileTreeNode[]) => void;
	} = $props();

	const sidebarTree = $derived((tree ?? $page.data.fileTree ?? []) as FileEntry[]);

	function handleSelect(event: CustomEvent<{ path: string; kind: 'file' | 'directory' }>) {
		dispatch('select', event.detail);
	}

	function openTrash() {
		dispatch('select', { path: mediaTrashBrowsePath(activePath ?? ''), kind: 'directory' });
	}
</script>

<div class="flex h-full w-full min-w-0 flex-col overflow-hidden">
	<div class="flex-1 overflow-x-hidden overflow-y-auto p-2">
		{#if sidebarTree.length}
			<Sidebar.Menu class="w-full">
				<FileTree
					tree={sidebarTree}
					{activePath}
					parentPath=""
					{folderChildrenLoader}
					{mergeFolderChildren}
					on:select={handleSelect}
				/>
			</Sidebar.Menu>
		{:else}
			<div class="px-3 text-xs text-muted-foreground">Loading files...</div>
		{/if}
	</div>
	<div class="shrink-0 border-t border-border p-2">
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="w-full justify-start gap-2 text-muted-foreground"
			title="Open the Trash folder for this drive"
			aria-label="Trash"
			onclick={openTrash}
		>
			<Trash2Icon class="size-4 shrink-0" aria-hidden="true" />
			<span>Trash</span>
		</Button>
	</div>
</div>
