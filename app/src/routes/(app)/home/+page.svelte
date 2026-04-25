<script lang="ts">
	import PageShell from '$lib/components/page-shell.svelte';
	import type { PageData } from './$types';
	import ChatComposer from '$lib/components/chat-llm/chat-composer.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import FilmIcon from '@lucide/svelte/icons/film';
	import TvIcon from '@lucide/svelte/icons/tv';
	import MusicIcon from '@lucide/svelte/icons/music';
	import ImageIcon from '@lucide/svelte/icons/image';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SettingsIcon from '@lucide/svelte/icons/settings';

	let { data }: { data: PageData } = $props();
	const username = $derived(data.user?.username ?? '');

	function greeting(): string {
		const h = new Date().getHours();
		if (h < 12) return 'Good morning';
		if (h < 18) return 'Good afternoon';
		return 'Good evening';
	}

	let composerValue = $state('');

	function handleSubmit() {
		if (!composerValue.trim()) return;
	}

	const quickPrompts = [
		'Find all movies from 2020',
		'Play latest episode',
		'Organize music library'
	];

	const quickAccess = [
		{ label: 'Movies', bg: 'bg-green-50', color: 'text-green-700', icon: FilmIcon },
		{ label: 'TV Shows', bg: 'bg-blue-50', color: 'text-blue-700', icon: TvIcon },
		{ label: 'Music', bg: 'bg-amber-50', color: 'text-amber-700', icon: MusicIcon },
		{ label: 'Photos', bg: 'bg-pink-50', color: 'text-pink-700', icon: ImageIcon }
	];

	const recentFiles = [
		{ name: 'Trash', active: false },
		{ name: 'testMedia', active: false },
		{ name: 'ajay', active: true }
	];
</script>

<PageShell title={greeting() + (username ? `, ${username}` : '')} containerClass="max-w-none">
	<div class="space-y-6 p-4 sm:p-6 lg:p-8">
		<section class="space-y-3">
			<ChatComposer
				bind:value={composerValue}
				placeholder="Find movies, play media, organize library..."
				onSubmit={handleSubmit}
			/>
			<div class="flex flex-wrap justify-center gap-2">
				{#each quickPrompts as prompt (prompt)}
					<Button
						variant="outline"
						size="sm"
						class="rounded-full"
						onclick={() => (composerValue = prompt)}
					>
						{prompt}
					</Button>
				{/each}
			</div>
		</section>

		<section class="columns-1 gap-4 md:columns-2 xl:columns-3">
			<Card class="mb-4 break-inside-avoid">
				<CardHeader class="flex flex-row items-center justify-between">
					<CardTitle class="text-sm font-medium">Agents</CardTitle>
					<Button variant="ghost" size="sm" class="text-xs text-muted-foreground">View all →</Button
					>
				</CardHeader>
				<CardContent>
					<div class="flex items-center gap-2.5">
						<div class="h-1.5 w-1.5 rounded-full bg-green-500"></div>
						<span class="text-sm text-foreground">Goodbye</span>
						<span class="ml-auto text-xs text-muted-foreground">4 messages</span>
					</div>
				</CardContent>
			</Card>
			<!-- Quick Access -->
			<Card class="mb-4 break-inside-avoid">
				<CardHeader class="flex flex-row items-center justify-between">
					<CardTitle class="text-sm font-medium">Quick access</CardTitle>
					<Button variant="ghost" size="sm" class="text-xs text-muted-foreground"
						>Browse all →</Button
					>
				</CardHeader>
				<CardContent>
					<div class="grid grid-cols-2 gap-2">
						{#each quickAccess as item (item.label)}
							<button
								class="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
							>
								<div
									class="h-7 w-7 rounded-md {item.bg} {item.color} flex shrink-0 items-center justify-center"
								>
									<item.icon class="h-3.5 w-3.5" />
								</div>
								<div>
									<div class="text-sm font-medium text-foreground">{item.label}</div>
									<div class="text-xs text-muted-foreground">Browse</div>
								</div>
							</button>
						{/each}
					</div>
				</CardContent>
			</Card>

			<!-- Recent Files -->
			<Card class="mb-4 break-inside-avoid">
				<CardHeader>
					<CardTitle class="text-sm font-medium">Recent files</CardTitle>
				</CardHeader>
				<CardContent>
					{#each recentFiles as file, i (file.name)}
						<div
							class="flex cursor-pointer items-center gap-2.5 py-2 {i < recentFiles.length - 1
								? 'border-b border-border/50'
								: ''}"
						>
							<div
								class="h-1.5 w-1.5 shrink-0 rounded-full {file.active
									? 'bg-blue-400'
									: 'bg-muted-foreground/30'}"
							></div>
							<span class="text-sm {file.active ? 'text-blue-500' : 'text-foreground'}"
								>{file.name}</span
							>
						</div>
					{/each}
				</CardContent>
			</Card>

			<Card class="mb-4 break-inside-avoid">
				<CardHeader>
					<CardTitle class="text-sm font-medium">Quick actions</CardTitle>
				</CardHeader>
				<CardContent class="flex flex-col gap-2">
					<button
						class="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
					>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"
						>
							<SearchIcon class="h-3.5 w-3.5" />
						</div>
						Search library
					</button>
					<button
						class="flex items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
					>
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700"
						>
							<SettingsIcon class="h-3.5 w-3.5" />
						</div>
						Settings
					</button>
				</CardContent>
			</Card>
		</section>
	</div>
</PageShell>
