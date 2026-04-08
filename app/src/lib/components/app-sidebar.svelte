<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ComponentProps } from 'svelte';
	import {
		ChevronRight,
		Folder,
		FolderOpen,
		HardDrive,
		Home,
		Search,
		Settings2,
		Upload
	} from '@lucide/svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	interface Entry {
		name: string;
		path: string;
		type: 'file' | 'directory';
	}

	interface DriveInfo {
		index: number;
		name: string;
		available: boolean;
	}

	interface TreeItem {
		name: string;
		path: string;
		depth: number;
		isCurrentFolder: boolean;
		isAncestor: boolean;
	}

	let {
		ref = $bindable(null),
		drives = [],
		entries = [],
		currentPath = '',
		selectedPaths = [],
		semanticQuery = '',
		isSemanticMode = false,
		onBrowse = () => {},
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		drives?: DriveInfo[];
		entries?: Entry[];
		currentPath?: string;
		selectedPaths?: string[];
		semanticQuery?: string;
		isSemanticMode?: boolean;
		onBrowse?: (path: string) => void;
	} = $props();

	const directoryEntries = $derived(entries.filter((entry) => entry.type === 'directory'));
	const currentSegments = $derived(currentPath.split('/').filter(Boolean));

	// Build a flat tree for the active drive: ancestors → current folder → children
	const treeItems = $derived.by((): TreeItem[] => {
		if (currentSegments.length === 0) return [];
		const items: TreeItem[] = [];

		// Path segments from just below the drive root down to current folder
		for (let i = 1; i < currentSegments.length; i++) {
			const segPath = currentSegments.slice(0, i + 1).join('/');
			const isCurrentFolder = i === currentSegments.length - 1;
			items.push({
				name: currentSegments[i],
				path: segPath,
				depth: i - 1,
				isCurrentFolder,
				isAncestor: !isCurrentFolder
			});
		}

		// Children of the current folder (subdirectories only)
		const childDepth = Math.max(0, currentSegments.length - 1);
		for (const entry of directoryEntries) {
			items.push({
				name: entry.name,
				path: entry.path,
				depth: childDepth,
				isCurrentFolder: false,
				isAncestor: false
			});
		}

		return items;
	});

	function openSettings() {
		goto(resolve('/settings'));
	}

	function openUploads() {
		goto(currentPath ? resolve(`/upload?dest=${currentPath}`) : resolve('/upload'));
	}
</script>

<Sidebar.Root
	bind:ref
	variant="inset"
	collapsible="icon"
	class="border-r border-sidebar-border/70"
	{...restProps}
>
	<Sidebar.Content class="px-2 py-3">
		<!-- Workspace navigation -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							onclick={() => onBrowse('')}
							isActive={currentPath === '' && !isSemanticMode}
						>
							<Home />
							<span>Home</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton onclick={openUploads}>
							<Upload />
							<span>Uploads</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton onclick={openSettings}>
							<Settings2 />
							<span>Settings</span>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={isSemanticMode}>
							<Search />
							<span>Semantic Search</span>
						</Sidebar.MenuButton>
						{#if isSemanticMode}
							<Sidebar.MenuBadge>{semanticQuery ? 'Live' : 'On'}</Sidebar.MenuBadge>
						{/if}
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Separator />

		<!-- Locations with file tree -->
		<Sidebar.Group>
			<Sidebar.GroupLabel>Locations</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each drives as drive (drive.index)}
						{@const driveStr = String(drive.index)}
						{@const isActiveDrive =
							currentPath === driveStr || currentPath.startsWith(driveStr + '/')}
						{@const hasTree = isActiveDrive && treeItems.length > 0}

						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								onclick={() => onBrowse(driveStr)}
								isActive={currentPath === driveStr && !isSemanticMode}
							>
								<HardDrive />
								<span>{drive.name}</span>
								{#if hasTree}
									<ChevronRight
										class="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform"
									/>
								{/if}
							</Sidebar.MenuButton>

							{#if hasTree}
								<Sidebar.MenuSub>
									{#each treeItems as item (item.path)}
										<Sidebar.MenuSubItem>
											<Sidebar.MenuSubButton
												onclick={() => onBrowse(item.path)}
												isActive={item.isCurrentFolder}
												style="padding-left: {item.depth * 10 + 8}px"
											>
												{#if item.isCurrentFolder}
													<FolderOpen class="h-4 w-4 shrink-0" />
												{:else if item.isAncestor}
													<Folder
														class="h-4 w-4 shrink-0 text-sidebar-foreground/60"
													/>
												{:else}
													<Folder class="h-4 w-4 shrink-0" />
												{/if}
												<span
													class={item.isAncestor
														? 'text-sidebar-foreground/60'
														: ''}
												>
													{item.name}
												</span>
											</Sidebar.MenuSubButton>
										</Sidebar.MenuSubItem>
									{/each}
								</Sidebar.MenuSub>
							{/if}
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	{#if selectedPaths.length > 0}
		<Sidebar.Footer>
			<div class="px-3 py-2 text-xs text-sidebar-foreground/60">
				{selectedPaths.length}
				{selectedPaths.length === 1 ? 'item' : 'items'} selected
			</div>
		</Sidebar.Footer>
	{/if}

	<Sidebar.Rail />
</Sidebar.Root>
