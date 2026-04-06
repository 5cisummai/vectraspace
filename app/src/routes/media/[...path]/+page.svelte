<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Download, FileQuestion, Volume2, Maximize } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';

	interface Props {
		data: { path: string };
	}

	let { data }: Props = $props();

	const path = $derived(data.path);
	const streamUrl = $derived(`/api/stream/${path}`);
	const filename = $derived(path.split('/').at(-1) ?? path);
	const ext = $derived(filename.split('.').at(-1)?.toLowerCase() ?? '');

	type MediaType = 'video' | 'audio' | 'image' | 'document' | 'unknown';

	function getMediaType(): MediaType {
		if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) return 'video';
		if (['mp3', 'flac', 'ogg', 'wav', 'aac', 'm4a'].includes(ext)) return 'audio';
		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return 'image';
		if (['pdf', 'epub', 'cbz', 'cbr'].includes(ext)) return 'document';
		return 'unknown';
	}

	const mediaType = getMediaType();

	// Build the parent path to go back to
	const parentPath = $derived(path.split('/').slice(0, -1).join('/'));

	function goBack() {
		goto(`/?browse=${parentPath}`);
	}

	function formatName(name: string) {
		return name.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
	}
</script>

<div class="min-h-screen bg-background text-foreground">
	<!-- Topbar -->
	<header class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={goBack}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Separator orientation="vertical" class="h-5" />
			<span class="min-w-0 flex-1 truncate font-medium">{formatName(filename)}</span>
			<Badge variant="outline" class="shrink-0 uppercase">{ext}</Badge>
			<a href={streamUrl} download={filename}>
				<Button variant="outline" size="sm">
					<Download class="mr-2 h-3.5 w-3.5" />
					Download
				</Button>
			</a>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-8">
		<!-- Video player -->
		{#if mediaType === 'video'}
			<Card.Root class="overflow-hidden">
				<Card.Content class="p-0">
					<video src={streamUrl} controls class="max-h-[80vh] w-full bg-black" preload="metadata">
						<track kind="captions" />
						Your browser does not support video playback.
					</video>
				</Card.Content>
				<Card.Footer class="flex items-center gap-2 px-4 py-3">
					<Maximize class="h-4 w-4 text-muted-foreground" />
					<span class="text-sm text-muted-foreground"
						>Use fullscreen button in the player controls</span
					>
				</Card.Footer>
			</Card.Root>

			<!-- Audio player -->
		{:else if mediaType === 'audio'}
			<div class="flex flex-col items-center gap-8 py-16">
				<div
					class="flex h-40 w-40 items-center justify-center rounded-full border-4 border-border bg-muted"
				>
					<Volume2 class="h-16 w-16 text-muted-foreground" />
				</div>
				<div class="text-center">
					<h1 class="text-2xl font-semibold">{formatName(filename)}</h1>
					<p class="mt-1 text-sm text-muted-foreground uppercase">{ext} audio</p>
				</div>
				<Card.Root class="w-full max-w-xl">
					<Card.Content class="px-6 py-4">
						<audio src={streamUrl} controls class="w-full" preload="metadata">
							Your browser does not support audio playback.
						</audio>
					</Card.Content>
				</Card.Root>
			</div>

			<!-- Image viewer -->
		{:else if mediaType === 'image'}
			<div class="flex flex-col items-center gap-4">
				<Card.Root class="overflow-hidden">
					<Card.Content class="p-0">
						<img src={streamUrl} alt={filename} class="max-h-[80vh] max-w-full object-contain" />
					</Card.Content>
				</Card.Root>
				<p class="text-sm text-muted-foreground">{filename}</p>
			</div>

			<!-- PDF viewer -->
		{:else if mediaType === 'document' && ext === 'pdf'}
			<Card.Root class="overflow-hidden">
				<Card.Content class="p-0">
					<iframe src={streamUrl} title={filename} class="h-[85vh] w-full border-0"></iframe>
				</Card.Content>
			</Card.Root>

			<!-- Unsupported document types -->
		{:else if mediaType === 'document'}
			<div class="flex flex-col items-center gap-6 py-24 text-muted-foreground">
				<FileQuestion class="h-16 w-16 opacity-40" />
				<div class="text-center">
					<p class="font-medium text-foreground">{filename}</p>
					<p class="mt-1 text-sm">Preview not available for .{ext} files</p>
				</div>
				<a href={streamUrl} download={filename}>
					<Button>
						<Download class="mr-2 h-4 w-4" />
						Download to open
					</Button>
				</a>
			</div>

			<!-- Unknown file type -->
		{:else}
			<div class="flex flex-col items-center gap-6 py-24 text-muted-foreground">
				<FileQuestion class="h-16 w-16 opacity-40" />
				<div class="text-center">
					<p class="font-medium text-foreground">{filename}</p>
					<p class="mt-1 text-sm">Unknown file type</p>
				</div>
				<a href={streamUrl} download={filename}>
					<Button variant="outline">
						<Download class="mr-2 h-4 w-4" />
						Download
					</Button>
				</a>
			</div>
		{/if}
	</main>
</div>
