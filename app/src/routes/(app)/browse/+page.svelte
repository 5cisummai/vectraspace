<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FileBrowser from '$lib/components/file-browser/file-broswer.svelte';
	import type { FileEntry } from '$lib/components/file-browser/file-grid.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import MusicIcon from '@lucide/svelte/icons/music';

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
			const isDirectory =
				node.type === 'directory' || node.type === 'folder' || !!node.children?.length;
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
	const currentPath = $derived(($page.url.searchParams.get('path') ?? '') as string);
	const selectedFile = $derived(($page.url.searchParams.get('file') ?? '') as string);

	const MEDIA_EXTENSIONS = {
		video: ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'ogv'],
		audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma'],
		image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico']
	};

	function getMediaType(path: string): 'video' | 'audio' | 'image' | null {
		const ext = path.split('.').pop()?.toLowerCase() ?? '';
		if (MEDIA_EXTENSIONS.video.includes(ext)) return 'video';
		if (MEDIA_EXTENSIONS.audio.includes(ext)) return 'audio';
		if (MEDIA_EXTENSIONS.image.includes(ext)) return 'image';
		return null;
	}

	const mediaType = $derived(getMediaType(selectedFile));
	const mediaUrl = $derived(selectedFile ? `/api/stream/${selectedFile}` : '');
	const fileName = $derived(selectedFile.split('/').pop() ?? 'Unknown');

	function goBack() {
		const url = new URL($page.url);
		url.searchParams.delete('file');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(url.pathname + url.search, { keepFocus: true });
	}

	function handlePathChange(path: string) {
		const url = new URL($page.url);
		if (path) {
			url.searchParams.set('path', path);
		} else {
			url.searchParams.delete('path');
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(url.pathname + url.search, { keepFocus: true });
	}

	function handleFileSelect(event: CustomEvent<FileEntry>) {
		const url = new URL($page.url);
		url.searchParams.set('file', event.detail.path);
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(url.pathname + url.search, { keepFocus: true });
	}
</script>

{#if selectedFile && mediaType}
	<div class="flex h-full flex-col bg-black">
		<header class="flex shrink-0 items-center gap-4 border-b border-white/10 px-4 py-3">
			<button
				type="button"
				class="text-white/70 transition-colors hover:text-white"
				onclick={goBack}
				title="Back to browser"
			>
				<ArrowLeftIcon class="size-5" />
			</button>
			<h1 class="truncate text-sm font-medium text-white">{fileName}</h1>
		</header>

		<main class="flex flex-1 items-center justify-center overflow-hidden p-4">
			{#if mediaType === 'video'}
				<video src={mediaUrl} class="max-h-full max-w-full object-contain" controls autoplay>
					<track kind="captions" />
				</video>
			{:else if mediaType === 'audio'}
				<div class="flex flex-col items-center gap-6">
					<div class="flex items-center justify-center rounded-full bg-white/10 p-12">
						<MusicIcon class="size-16 text-white" />
					</div>
					<audio src={mediaUrl} controls class="w-full max-w-md">
						<track kind="captions" />
					</audio>
				</div>
			{:else if mediaType === 'image'}
				<img src={mediaUrl} alt={fileName} class="max-h-full max-w-full object-contain" />
			{/if}
		</main>
	</div>
{:else}
	<div class="h-screen w-full bg-background text-foreground">
		<FileBrowser
			fileTree={browserTree}
			selectedPath={null}
			{currentPath}
			on:select={handleFileSelect}
			on:pathChange={(e) => handlePathChange(e.detail)}
		/>
	</div>
{/if}
