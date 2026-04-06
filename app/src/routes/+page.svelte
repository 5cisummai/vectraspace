<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		Home,
		HardDrive,
		Server,
		Upload,
		Grid,
		List,
		AlertCircle,
		Search,
		RefreshCw,
		X
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import MediaIcon from '$lib/components/media-icon.svelte';
	import { page } from '$app/stores';
	type MediaType = 'video' | 'audio' | 'image' | 'document' | 'other';

	interface Entry {
		name: string;
		path: string;
		type: 'file' | 'directory';
		mediaType?: MediaType;
		mimeType?: string;
		size?: number;
		modified?: string;
	}

	interface SearchResponseItem {
		name: string;
		path: string;
		type: 'file';
		mediaType?: MediaType;
		mimeType?: string;
		size?: number;
		modified?: string;
	}

	interface SearchResponse {
		results: SearchResponseItem[];
	}

	interface DriveInfo {
		index: number;
		name: string;
		available: boolean;
	}

	let entries = $state<Entry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let viewMode = $state<'grid' | 'list'>('grid');
	let currentPath = $state('');
	let drives = $state<DriveInfo[]>([]);

	let semanticQuery = $state('');
	let semanticMediaType = $state('');
	let semanticRoot = $state('');
	let semanticResults = $state<Entry[]>([]);
	let semanticLoading = $state(false);
	let semanticError = $state<string | null>(null);
	let reindexing = $state(false);
	let reindexMessage = $state<string | null>(null);

	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let searchAbortController: AbortController | null = null;

	let isSemanticMode = $derived(semanticQuery.trim().length > 0);
	let displayEntries = $derived(isSemanticMode ? semanticResults : entries);

	let breadcrumbs = $derived.by(() => {
		if (!currentPath) return [];
		const parts = currentPath.split('/').filter(Boolean);
		return parts.map((part, i) => ({
			name: i === 0 ? 'Drive ' + part : part,
			path: parts.slice(0, i + 1).join('/')
		}));
	});

	async function browse(path: string) {
		loading = true;
		error = null;
		currentPath = path;
		try {
			const res = await fetch(`/api/browse${path ? '/' + path : ''}`);
			if (!res.ok) throw new Error(await res.text());
			entries = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load';
		} finally {
			loading = false;
		}
	}

	async function loadDrives() {
		try {
			const res = await fetch('/api/storage');
			if (!res.ok) return;
			const data = (await res.json()) as DriveInfo[];
			drives = data.filter((drive) => drive.available);
		} catch {
			// Drive list is optional for semantic root filter.
		}
	}

	function toEntry(item: SearchResponseItem): Entry {
		return {
			name: item.name,
			path: item.path,
			type: 'file',
			mediaType: item.mediaType,
			mimeType: item.mimeType,
			size: item.size,
			modified: item.modified
		};
	}

	function clearSemanticSearch() {
		semanticResults = [];
		semanticError = null;
		semanticLoading = false;
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
			searchDebounceTimer = null;
		}
		if (searchAbortController) {
			searchAbortController.abort();
			searchAbortController = null;
		}
	}

	async function runSemanticSearch() {
		const query = semanticQuery.trim();
		if (!query) {
			clearSemanticSearch();
			return;
		}

		if (searchAbortController) searchAbortController.abort();
		const controller = new AbortController();
		searchAbortController = controller;

		const params = [`q=${encodeURIComponent(query)}`];
		if (semanticMediaType) params.push(`mediaType=${encodeURIComponent(semanticMediaType)}`);
		if (semanticRoot) params.push(`root=${encodeURIComponent(semanticRoot)}`);

		semanticLoading = true;
		semanticError = null;

		try {
			const res = await fetch(`/api/search?${params.join('&')}`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(await res.text());
			const body = (await res.json()) as SearchResponse;
			semanticResults = (body.results ?? []).map(toEntry);
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') return;
			semanticError = e instanceof Error ? e.message : 'Semantic search failed';
			semanticResults = [];
		} finally {
			if (searchAbortController === controller) {
				semanticLoading = false;
				searchAbortController = null;
			}
		}
	}

	function queueSemanticSearch() {
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		if (!semanticQuery.trim()) {
			clearSemanticSearch();
			return;
		}
		searchDebounceTimer = setTimeout(() => {
			searchDebounceTimer = null;
			void runSemanticSearch();
		}, 250);
	}

	function handleSemanticInput() {
		reindexMessage = null;
		queueSemanticSearch();
	}

	function handleSemanticFilterChange() {
		reindexMessage = null;
		if (isSemanticMode) queueSemanticSearch();
	}

	async function reindexSemantic() {
		reindexing = true;
		reindexMessage = null;
		try {
			const res = await fetch('/api/search/reindex', { method: 'POST' });
			if (!res.ok) throw new Error(await res.text());
			const body = (await res.json()) as {
				summary?: { indexed?: number; deleted?: number; skipped?: number };
			};
			const indexed = body.summary?.indexed ?? 0;
			const deleted = body.summary?.deleted ?? 0;
			const skipped = body.summary?.skipped ?? 0;
			reindexMessage = `Reindex complete: ${indexed} indexed, ${deleted} deleted, ${skipped} skipped.`;
			if (isSemanticMode) {
				void runSemanticSearch();
			}
		} catch (e) {
			reindexMessage = e instanceof Error ? e.message : 'Reindex failed';
		} finally {
			reindexing = false;
		}
	}

	function openEntry(entry: Entry) {
		if (entry.type === 'directory') {
			browse(entry.path);
		} else {
			goto(resolve(`/media/${entry.path}`));
		}
	}

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
		return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

	function getBadgeVariant(entry: Entry): BadgeVariant {
		if (entry.type === 'directory') return 'secondary';
		switch (entry.mediaType) {
			case 'video':
				return 'default';
			case 'audio':
				return 'outline';
			case 'image':
				return 'secondary';
			case 'document':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getBadgeLabel(entry: Entry): string {
		if (entry.type === 'directory') return 'folder';
		return entry.mediaType ?? 'file';
	}

	onMount(() => {
		const initialPath = $page.url.searchParams.get('browse') ?? '';
		browse(initialPath);
		void loadDrives();

		return () => {
			if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
			if (searchAbortController) searchAbortController.abort();
		};
	});
</script>

<div class="min-h-screen bg-background text-foreground">
	<!-- Topbar -->
	<header class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
			<HardDrive class="h-5 w-5 text-primary" />
			<span class="font-semibold tracking-tight">MediaServer</span>

			<Separator orientation="vertical" class="mx-1 h-5" />

			<!-- Breadcrumbs -->
			<Breadcrumb.Root class="min-w-0 flex-1">
				<Breadcrumb.List>
					<Breadcrumb.Item>
						<Breadcrumb.Link
							class="flex items-center gap-1"
							onclick={() => browse('')}
							href={undefined}
						>
							<Home class="h-3.5 w-3.5" />
							Home
						</Breadcrumb.Link>
					</Breadcrumb.Item>

					{#each breadcrumbs as crumb, i (crumb.path)}
						<Breadcrumb.Separator />
						<Breadcrumb.Item>
							{#if i === breadcrumbs.length - 1}
								<Breadcrumb.Page>{crumb.name}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link onclick={() => browse(crumb.path)} href={undefined}>
									{crumb.name}
								</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>

			<!-- Actions -->
			<div class="flex items-center gap-2">
				<Button size="sm" onclick={() => goto(resolve(`/upload?dest=${currentPath}`))}>
					<Upload class="mr-2 h-3.5 w-3.5" />
					Upload
				</Button>
				<Separator orientation="vertical" class="h-5" />
				<div class="flex rounded-md border border-border">
					<Button
						variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-8 w-8 rounded-r-none"
						onclick={() => (viewMode = 'grid')}
					>
						<Grid class="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === 'list' ? 'secondary' : 'ghost'}
						size="icon"
						class="h-8 w-8 rounded-l-none"
						onclick={() => (viewMode = 'list')}
					>
						<List class="h-4 w-4" />
					</Button>
					<Separator orientation="vertical" class="h-5" />
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8"
						onclick={() => goto(resolve('/settings'))}
					>
						<Server class="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-6">
		<div class="mb-4 rounded-lg border border-border bg-card p-3">
			<div class="flex flex-col gap-3 md:flex-row md:items-center">
				<div class="relative flex-1">
					<Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						value={semanticQuery}
						oninput={(e) => {
							semanticQuery = (e.currentTarget as HTMLInputElement).value;
							handleSemanticInput();
						}}
						placeholder="Semantic search (for example: cinematic sunset over ocean)"
						class="h-9 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none ring-0 focus:border-primary"
					/>
					{#if isSemanticMode}
						<Button
							variant="ghost"
							size="icon"
							class="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
							onclick={() => {
								semanticQuery = '';
								semanticMediaType = '';
								semanticRoot = '';
								clearSemanticSearch();
							}}
						>
							<X class="h-4 w-4" />
						</Button>
					{/if}
				</div>

				<div class="flex gap-2">
					<select
						bind:value={semanticMediaType}
						onchange={handleSemanticFilterChange}
						class="h-9 rounded-md border border-border bg-background px-2 text-sm"
					>
						<option value="">All types</option>
						<option value="image">Images</option>
						<option value="video">Videos</option>
						<option value="audio">Audio</option>
						<option value="document">Documents</option>
						<option value="other">Other</option>
					</select>

					<select
						bind:value={semanticRoot}
						onchange={handleSemanticFilterChange}
						class="h-9 rounded-md border border-border bg-background px-2 text-sm"
					>
						<option value="">All drives</option>
						{#each drives as drive (drive.index)}
							<option value={String(drive.index)}>{drive.name}</option>
						{/each}
					</select>

					<Button variant="outline" size="sm" onclick={reindexSemantic} disabled={reindexing}>
						<RefreshCw class="mr-2 h-3.5 w-3.5 {reindexing ? 'animate-spin' : ''}" />
						Reindex
					</Button>
				</div>
			</div>

			<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
				{#if isSemanticMode}
					<span>{displayEntries.length} semantic result{displayEntries.length === 1 ? '' : 's'}</span>
				{/if}
				{#if semanticLoading}
					<span>Searching...</span>
				{/if}
				{#if reindexMessage}
					<span>{reindexMessage}</span>
				{/if}
			</div>
		</div>

		<!-- Error state -->
		{#if error}
			<div
				class="mb-6 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				<AlertCircle class="h-4 w-4 shrink-0" />
				{error}
			</div>
		{/if}

		{#if semanticError}
			<div
				class="mb-6 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				<AlertCircle class="h-4 w-4 shrink-0" />
				{semanticError}
			</div>
		{/if}

		<!-- Loading state -->
		{#if loading}
			{#if viewMode === 'grid'}
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
						<Skeleton class="h-28 rounded-xl" />
					{/each}
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each Array.from({ length: 8 }, (_, i) => i) as i (i)}
						<Skeleton class="h-12 rounded-lg" />
					{/each}
				</div>
			{/if}

			<!-- Empty state -->
		{:else if displayEntries.length === 0}
			<div class="flex flex-col items-center gap-3 py-24 text-muted-foreground">
				<HardDrive class="h-12 w-12 opacity-30" />
				<p class="text-sm">{isSemanticMode ? 'No semantic matches found' : 'No media found here'}</p>
				{#if isSemanticMode}
					<p class="text-xs">Try broader wording or adjust filters.</p>
				{:else}
					<Button variant="outline" size="sm" onclick={() => browse('')}>Go home</Button>
				{/if}
			</div>

			<!-- Grid view -->
		{:else if viewMode === 'grid'}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				{#each displayEntries as entry (entry.path)}
					<button
						onclick={() => openEntry(entry)}
						class="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all duration-150 hover:border-primary/50 hover:bg-accent"
					>
						{#if entry.type === 'file' && entry.mediaType === 'image'}
							<div
								class="h-10 w-10 shrink-0 overflow-hidden rounded border border-border transition-transform duration-150 group-hover:scale-110"
							>
								<img
									src="/api/stream/{entry.path}"
									alt={entry.name}
									class="h-full w-full object-cover"
									loading="lazy"
								/>
							</div>
						{:else}
							<MediaIcon
								entryType={entry.type}
								mediaType={entry.mediaType}
								class="h-10 w-10 transition-transform duration-150 group-hover:scale-110
        {entry.type === 'directory' ? 'text-amber-400' : ''}
        {entry.mediaType === 'video' ? 'text-blue-400' : ''}
        {entry.mediaType === 'audio' ? 'text-purple-400' : ''}
        {entry.mediaType === 'image' ? 'text-green-400' : ''}
        {entry.mediaType === 'document' ? 'text-red-400' : ''}
        {entry.mediaType === 'other' ? 'text-muted-foreground' : ''}"
							/>
						{/if}
						<span class="w-full truncate text-xs font-medium text-foreground">{entry.name}</span>
						<Badge variant={getBadgeVariant(entry)} class="text-[10px]">
							{getBadgeLabel(entry)}
						</Badge>
					</button>
				{/each}
			</div>

			<!-- List view -->
		{:else}
			<div class="overflow-hidden rounded-lg border border-border">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th class="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
							<th
								class="hidden px-4 py-2.5 text-left font-medium text-muted-foreground sm:table-cell"
								>Type</th
							>
							<th
								class="hidden px-4 py-2.5 text-right font-medium text-muted-foreground md:table-cell"
								>Size</th
							>
							<th
								class="hidden px-4 py-2.5 text-right font-medium text-muted-foreground lg:table-cell"
								>Modified</th
							>
						</tr>
					</thead>
					<tbody>
						{#each displayEntries as entry, i (entry.path)}
							<tr
								onclick={() => openEntry(entry)}
								class="cursor-pointer border-border transition-colors hover:bg-muted/50
									{i !== displayEntries.length - 1 ? 'border-b' : ''}"
							>
								<td class="flex items-center gap-3 px-4 py-3">
									{#if entry.type === 'file' && entry.mediaType === 'image'}
										<div class="h-8 w-8 shrink-0 overflow-hidden rounded border border-border">
											<img
												src="/api/stream/{entry.path}"
												alt={entry.name}
												class="h-full w-full object-cover"
												loading="lazy"
											/>
										</div>
									{:else}
										<MediaIcon
											entryType={entry.type}
											mediaType={entry.mediaType}
											class="h-4 w-4 shrink-0
        {entry.type === 'directory' ? 'text-amber-400' : ''}
        {entry.mediaType === 'video' ? 'text-blue-400' : ''}
        {entry.mediaType === 'audio' ? 'text-purple-400' : ''}
        {entry.mediaType === 'image' ? 'text-green-400' : ''}
        {entry.mediaType === 'document' ? 'text-red-400' : ''}
        {entry.mediaType === 'other' ? 'text-muted-foreground' : ''}"
										/>
									{/if}
									<span class="truncate font-medium text-foreground">{entry.name}</span>
								</td>
								<td class="hidden px-4 py-3 sm:table-cell">
									<Badge variant={getBadgeVariant(entry)} class="text-[10px]">
										{getBadgeLabel(entry)}
									</Badge>
								</td>
								<td class="hidden px-4 py-3 text-right text-muted-foreground md:table-cell">
									{entry.size ? formatSize(entry.size) : '—'}
								</td>
								<td class="hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">
									{entry.modified ? formatDate(entry.modified) : '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>
