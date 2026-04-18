<script lang="ts" module>
	export type FileEntry = {
		id?: string;
		name: string;
		path: string;
		type: 'file' | 'directory';
		children?: FileEntry[];
	};
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';
	import { apiFetch } from '$lib/api-fetch';
	import { uploadManager } from '$lib/upload-manager';
	import { workspaceStore } from '$lib/hooks/workspace.svelte';
	import { fsHistory } from '$lib/hooks/fs-history.svelte';
	import FilePreviewTile from './file-preview-tile.svelte';

	let {
		fileTree = [],
		selectedPath = null,
		currentPath = '',
		gridMinTilePx = 176
	}: {
		fileTree?: FileEntry[];
		selectedPath?: string | null;
		currentPath?: string;
		/** Minimum column width — larger values produce bigger tiles and fewer columns. */
		gridMinTilePx?: number;
	} = $props();

	const dispatch = createEventDispatcher<{ select: FileEntry; refresh: void }>();

	type FlatEntry = FileEntry & { path: string };

	function flattenEntries(entries: FileEntry[] | undefined, parentPath = ''): FlatEntry[] {
		if (!entries) return [];

		return entries.flatMap((entry) => {
			const fullPath = entry.path ?? (parentPath ? `${parentPath}/${entry.name}` : entry.name);
			const current = { ...entry, path: fullPath };
			return [current, ...(entry.children ? flattenEntries(entry.children, fullPath) : [])];
		});
	}

	const items = $derived(flattenEntries(fileTree));

	function encodeMediaPath(relativePath: string): string {
		return relativePath
			.split('/')
			.filter((s) => s.length > 0)
			.map((seg) => encodeURIComponent(seg))
			.join('/');
	}

	async function readErrorMessage(res: Response): Promise<string> {
		const text = await res.text();
		try {
			const j = JSON.parse(text) as { message?: string };
			return j.message ?? text;
		} catch {
			return text || res.statusText;
		}
	}

	function notifyRefresh() {
		dispatch('refresh');
	}

	function selectEntry(entry: FlatEntry) {
		dispatch('select', entry);
	}

	function openEntry(entry: FlatEntry) {
		selectEntry(entry);
	}

	async function copyPath(path: string) {
		try {
			await navigator.clipboard.writeText(path);
			toast('Path copied');
		} catch {
			toast.error('Could not copy', { description: path });
		}
	}

	function renameNotSupported() {
		toast.info('Rename is not available yet');
	}

	function requireDirectory(): boolean {
		if (!currentPath?.trim()) {
			toast('Pick a location', {
				description: 'Open a drive or folder in the sidebar or breadcrumb first.'
			});
			return false;
		}
		return true;
	}

	let newFolderDialogOpen = $state(false);
	let newFolderName = $state('');
	let newFolderSubmitting = $state(false);
	let newFolderError = $state<string | null>(null);

	function newFolder() {
		if (!requireDirectory()) return;
		newFolderName = '';
		newFolderError = null;
		newFolderDialogOpen = true;
	}

	async function createFolderFromDialog(event?: SubmitEvent) {
		event?.preventDefault();
		const trimmed = newFolderName.trim().replace(/[/\\]/g, '');
		if (!trimmed) {
			newFolderError = 'Enter a valid folder name.';
			return;
		}

		newFolderSubmitting = true;
		newFolderError = null;
		try {
			const newPath = `${currentPath}/${trimmed}`;
			const mkdirHeaders: Record<string, string> = {};
			if (workspaceStore.activeId) mkdirHeaders['X-Workspace-Id'] = workspaceStore.activeId;
			const res = await apiFetch(`/api/mkdir/${encodeMediaPath(newPath)}`, {
				method: 'POST',
				headers: mkdirHeaders
			});
			if (!res.ok) {
				newFolderError = await readErrorMessage(res);
				return;
			}

			newFolderDialogOpen = false;
			toast.success('Folder created', {
				description: trimmed
			});
			fsHistory.refresh();
			notifyRefresh();
		} finally {
			newFolderSubmitting = false;
		}
	}

	let deleteDialogOpen = $state(false);
	let deleteSubmitting = $state(false);
	let deleteError = $state<string | null>(null);
	let pendingDeleteEntry = $state<FlatEntry | null>(null);

	function requestDelete(entry: FlatEntry) {
		pendingDeleteEntry = entry;
		deleteError = null;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!pendingDeleteEntry) return;

		deleteSubmitting = true;
		deleteError = null;
		try {
			const deleteHeaders: Record<string, string> = {};
			if (workspaceStore.activeId) deleteHeaders['X-Workspace-Id'] = workspaceStore.activeId;
			const res = await apiFetch(`/api/delete/${encodeMediaPath(pendingDeleteEntry.path)}`, {
				method: 'DELETE',
				headers: deleteHeaders
			});
			if (!res.ok) {
				deleteError = await readErrorMessage(res);
				return;
			}

			const deletedName = pendingDeleteEntry.name;
			deleteDialogOpen = false;
			pendingDeleteEntry = null;
			toast.success('Deleted', {
				description: deletedName
			});
			fsHistory.refresh();
			notifyRefresh();
		} finally {
			deleteSubmitting = false;
		}
	}

	let fileInput: HTMLInputElement | undefined = $state();
	/** Bound to the grid background context menu so we can close it after opening the file picker. */
	let gridContextMenuOpen = $state(false);

	function openUploadPicker() {
		if (!requireDirectory()) return;
		fileInput?.click();
	}

	/**
	 * Opening a hidden file input from a context menu item must not close the menu in the same
	 * turn: bits-ui closes the menu after select, which can unmount the portal and cancel the
	 * native file picker (no change event, no `/api/upload` request). We prevent that close,
	 * trigger the picker, then dismiss the menu on a microtask.
	 */
	function onUploadMenuSelect(e: Event) {
		if (!requireDirectory()) return;
		e.preventDefault();
		fileInput?.click();
		queueMicrotask(() => {
			gridContextMenuOpen = false;
		});
	}

	/** Header / toolbar “Upload” triggers the same file picker as the context menu. */
	export function triggerUpload() {
		openUploadPicker();
	}

	/** Header / toolbar “New folder” opens the same dialog as the grid context menu. */
	export function triggerNewFolder() {
		newFolder();
	}

	async function onUploadPicked(event: Event) {
		const input = event.target as HTMLInputElement;
		// Clone files to preserve them before resetting input
		const fileArray = input.multiple 
			? Array.from(input.files || []) 
			: input.files ? [input.files[0]] : [];
		
		console.log('[upload] onUploadPicked called', { fileCount: fileArray.length, currentPath });
		
		// Reset input to allow re-selecting same files
		input.value = '';
		
		if (!fileArray.length) {
			toast('No files selected');
			return;
		}
		if (!currentPath?.trim()) {
			toast('Pick a location', { description: 'Open a folder first' });
			return;
		}

		const fileList = new DataTransfer();
		fileArray.forEach(f => fileList.items.add(f));
		uploadManager.addFiles(currentPath, fileList.files, workspaceStore.activeId);
		uploadManager.uploadAll();
		fsHistory.refresh();
		notifyRefresh();
		toast('Uploading', { description: `${files.length} file(s)` });
	}

	function refresh() {
		toast('Refreshed');
		notifyRefresh();
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	class="sr-only"
	multiple
	tabindex={-1}
	onchange={onUploadPicked}
/>

<Dialog.Root bind:open={newFolderDialogOpen}>
	<Dialog.Content showCloseButton={!newFolderSubmitting}>
		<Dialog.Header>
			<Dialog.Title>New folder</Dialog.Title>
			<Dialog.Description>Create a folder inside `{currentPath || 'Root'}`.</Dialog.Description>
		</Dialog.Header>

		<form class="space-y-3" onsubmit={createFolderFromDialog}>
			<div class="space-y-2">
				<Label for="new-folder-name">Folder name</Label>
				<Input
					id="new-folder-name"
					placeholder="e.g. vacation-photos"
					bind:value={newFolderName}
					disabled={newFolderSubmitting}
					autofocus
				/>
			</div>
			{#if newFolderError}
				<p class="text-sm text-destructive">{newFolderError}</p>
			{/if}

			<Dialog.Footer>
				<Button
					variant="outline"
					disabled={newFolderSubmitting}
					onclick={() => (newFolderDialogOpen = false)}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={newFolderSubmitting}>
					{newFolderSubmitting ? 'Creating...' : 'Create folder'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content showCloseButton={!deleteSubmitting}>
		<Dialog.Header>
			<Dialog.Title>Delete item</Dialog.Title>
			<Dialog.Description>
				Delete `{pendingDeleteEntry?.name ?? 'this item'}`? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>

		{#if deleteError}
			<p class="text-sm text-destructive">{deleteError}</p>
		{/if}

		<Dialog.Footer>
			<Button
				variant="outline"
				disabled={deleteSubmitting}
				onclick={() => (deleteDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Deleting...' : 'Delete'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<ContextMenu.Root bind:open={gridContextMenuOpen}>
	<ContextMenu.Trigger class="flex h-full flex-col p-3">
		<div class="mb-3 flex shrink-0 items-center justify-between">
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Files</p>
			<p class="text-xs text-muted-foreground">{items.length} items</p>
		</div>

		<div class="flex-1 overflow-auto">
			<ul
				class="grid gap-3"
				style="grid-template-columns: repeat(auto-fill, minmax(min(100%, {gridMinTilePx}px), 1fr));"
			>
				{#each items as item (item.path)}
					<li>
						<ContextMenu.Root>
							<ContextMenu.Trigger>
								<Button
									variant="ghost"
									class="aspect-square h-auto w-full flex-col items-stretch justify-start gap-1 whitespace-normal rounded-xl p-1 text-center {selectedPath === item.path
										? 'bg-muted ring-1 ring-ring/60'
										: ''}"
									onclick={() => selectEntry(item)}
								>
									<FilePreviewTile
										class="h-full w-full min-h-0"
										item={{
											name: item.name,
											path: item.path,
											url: `/api/stream/${item.path}`,
											type: item.type
										}}
									/>
								</Button>
							</ContextMenu.Trigger>
							<ContextMenu.Content class="w-48">
								<ContextMenu.Item onclick={() => openEntry(item)}>Open</ContextMenu.Item>
								<ContextMenu.Item onclick={renameNotSupported}>Rename</ContextMenu.Item>
								<ContextMenu.Item onclick={() => copyPath(item.path)}>Copy path</ContextMenu.Item>
								<ContextMenu.Separator />
								<ContextMenu.Item variant="destructive" onclick={() => requestDelete(item)}>
									Delete
								</ContextMenu.Item>
							</ContextMenu.Content>
						</ContextMenu.Root>
					</li>
				{/each}
			</ul>
		</div>
	</ContextMenu.Trigger>

	<ContextMenu.Content class="w-48">
		<ContextMenu.Item onclick={newFolder}>New folder</ContextMenu.Item>
		<ContextMenu.Item onSelect={onUploadMenuSelect}>Upload file</ContextMenu.Item>
		<ContextMenu.Separator />
		<ContextMenu.Item onclick={refresh}>Refresh</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
