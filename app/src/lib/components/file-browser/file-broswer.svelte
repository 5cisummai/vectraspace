<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createEventDispatcher } from 'svelte';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { apiFetch } from '$lib/api-fetch';
	import FileBrowserSidebar from './file-browser-sidebar.svelte';
	import FileGrid from './file-grid.svelte';

	import type { FileEntry } from './file-grid.svelte';

	let {
		fileTree = [],
		selectedPath = null,
		currentPath = ''
	}: { fileTree?: FileEntry[]; selectedPath?: string | null; currentPath?: string } = $props();

	const dispatch = createEventDispatcher<{ select: FileEntry; pathChange: string }>();
	let folderContents = $state<FileEntry[]>([]);
	let loading = $state(false);
	let fileGrid = $state<{ triggerUpload: () => void } | null>(null);

	async function loadFolder(path: string) {
		loading = true;
		try {
			const url = path ? `/api/browse/${path}` : '/api/browse';
			const res = await apiFetch(url);
			if (res.ok) {
				const data = await res.json();
				if (!path) {
					folderContents = data.map((entry: { name: string; path: string; type: string }) => ({
						name: entry.name,
						path: entry.path,
						type: entry.type as 'file' | 'directory',
						children: entry.type === 'directory' ? [] : undefined
					}));
				} else {
					folderContents = data.map((entry: { name: string; path: string; type: string }) => ({
						name: entry.name,
						path: entry.path,
						type: entry.type as 'file' | 'directory',
						children: []
					}));
				}
			}
		} catch (e) {
			console.error('Failed to load folder:', e);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadFolder(currentPath);
	});

	function handleSidebarSelect(event: CustomEvent<string>) {
		const path = event.detail;
		if (path) {
			dispatch('pathChange', path);
		}
		dispatch('select', { path, name: path.split('/').pop() ?? '', type: 'directory' });
	}

	function handleGridSelect(event: CustomEvent<FileEntry>) {
		const entry = event.detail;
		if (entry.type === 'directory') {
			dispatch('pathChange', entry.path);
		} else {
			dispatch('select', entry);
		}
	}

	async function handleGridRefresh() {
		await loadFolder(currentPath);
		await invalidateAll();
	}

	function navigateTo(path: string) {
		dispatch('pathChange', path);
	}

	const pathSegments = $derived(currentPath ? currentPath.split('/').filter(Boolean) : []);
</script>

<div class="flex h-full flex-col overflow-hidden">
	<header class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
		<Breadcrumb.Root class="min-w-0 flex-1">
			<Breadcrumb.List>
				<Breadcrumb.Item>
					<button
						type="button"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						onclick={() => navigateTo('')}
					>
						Root
					</button>
				</Breadcrumb.Item>
				{#each pathSegments as segment, index (index)}
					<Breadcrumb.Separator />
					<Breadcrumb.Item>
						{#if index === pathSegments.length - 1}
							<Breadcrumb.Page class="text-sm font-medium">{segment}</Breadcrumb.Page>
						{:else}
							<button
								type="button"
								class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
								onclick={() => navigateTo(pathSegments.slice(0, index + 1).join('/'))}
							>
								{segment}
							</button>
						{/if}
					</Breadcrumb.Item>
				{/each}
			</Breadcrumb.List>
		</Breadcrumb.Root>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="shrink-0 gap-1.5"
			disabled={loading}
			onclick={() => fileGrid?.triggerUpload()}
		>
			<UploadIcon class="size-4" />
			Upload
		</Button>
	</header>

	<Resizable.PaneGroup direction="horizontal" class="flex-1">
		<Resizable.Pane defaultSize={20} minSize={15} maxSize={40} class="overflow-hidden">
			<div class="h-full overflow-hidden">
				<FileBrowserSidebar
					tree={fileTree}
					activePath={currentPath}
					on:select={handleSidebarSelect}
				/>
			</div>
		</Resizable.Pane>
		<Resizable.Handle withHandle />
		<Resizable.Pane class="overflow-hidden">
			{#if loading}
				<div class="flex h-full items-center justify-center p-8 text-muted-foreground">
					Loading...
				</div>
			{:else}
				<FileGrid
					bind:this={fileGrid}
					fileTree={folderContents}
					{selectedPath}
					{currentPath}
					on:select={handleGridSelect}
					on:refresh={handleGridRefresh}
				/>
			{/if}
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>
