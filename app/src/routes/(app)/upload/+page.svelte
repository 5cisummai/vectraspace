<script lang="ts">
	import { goto } from '$app/navigation';
	import { uploadManager } from '$lib/upload-manager';
	import {
		ArrowLeft,
		Upload,
		X,
		CheckCircle,
		AlertCircle,
		RefreshCw,
		File as FileIcon
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import AppTopbar from '$lib/components/app-topbar.svelte';

	interface Props {
		data: { dest: string };
	}

	let { data }: Props = $props();

	const dest = $derived(data.dest);
	let dragOver = $state(false);

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
		return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	}

	function addFiles(incoming: FileList | File[]) {
		uploadManager.addFiles(dest, incoming);
	}

	function onFileInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (input.files) addFiles(input.files);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function goBack() {
		goto(`/?browse=${dest}`);
	}

	const files = $derived($uploadManager.items);
	const busy = $derived($uploadManager.batchPhase === 'uploading' || $uploadManager.batchPhase === 'indexing');
	const allDone = $derived(files.length > 0 && files.every((file) => file.status === 'done'));
	const hasPending = $derived(files.some((file) => file.status === 'pending'));
	const hasErrors = $derived(files.some((file) => file.status === 'error'));
</script>

<div class="min-h-screen bg-background text-foreground">
	<AppTopbar>
		{#snippet left()}
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={goBack}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Separator orientation="vertical" class="h-5" />
		{/snippet}

		{#snippet center()}
			<span class="font-medium">Upload files</span>
			{#if dest}
				<Badge variant="outline" class="font-mono text-xs">→ {dest}</Badge>
			{/if}
		{/snippet}
	</AppTopbar>

	<main class="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">

		<!-- Drop zone -->
		<Card.Root
			class="border-2 border-dashed transition-colors duration-150
				{dragOver ? 'border-primary bg-primary/5' : 'border-border'}"
		>
			<Card.Content class="flex flex-col items-center gap-4 py-16"
				ondrop={onDrop}
				ondragover={onDragOver}
				ondragleave={onDragLeave}
				role="region"
				aria-label="File drop zone"
			>
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
					<Upload class="h-7 w-7 text-muted-foreground" />
				</div>
				<div class="text-center">
					<p class="font-medium">Drop files here</p>
					<p class="mt-1 text-sm text-muted-foreground">or click to browse</p>
				</div>
				<label>
					<Button variant="outline" size="sm" onclick={(e) => e.currentTarget.parentElement?.querySelector('input')?.click()}>
						Browse files
					</Button>
					<input
						type="file"
						multiple
						class="hidden"
						onchange={onFileInput}
					/>
				</label>
			</Card.Content>
		</Card.Root>

		<!-- File list -->
		{#if files.length > 0}
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
					<div class="flex gap-2">
						{#if hasErrors}
							<Button
								variant="ghost"
								size="sm"
								onclick={uploadManager.clearErrors}
							>
								Clear errors
							</Button>
						{/if}
						{#if hasPending}
							<Button size="sm" onclick={() => uploadManager.uploadAll()} disabled={busy}>
								<Upload class="mr-2 h-3.5 w-3.5" />
								Upload all
							</Button>
						{/if}
					</div>
				</div>

				{#if $uploadManager.batchPhase === 'uploading'}
					<div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
						Uploads are running in the background. You can leave this page and indexing will start when the upload batch finishes.
					</div>
				{:else if $uploadManager.batchPhase === 'indexing'}
					<div class="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
						<RefreshCw class="h-4 w-4 animate-spin" />
						Indexing uploaded files...
					</div>
				{:else if $uploadManager.batchMessage}
					<div class="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
						{$uploadManager.batchMessage}
					</div>
				{/if}

				<Card.Root>
					<Card.Content class="divide-y divide-border p-0">
						{#each files as item (item.id)}
							<div class="flex items-center gap-3 px-4 py-3">
								<!-- Icon -->
								<FileIcon class="h-5 w-5 shrink-0 text-muted-foreground" />

								<!-- Name + progress -->
								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between gap-2">
										<span class="truncate text-sm font-medium">{item.name}</span>
										<span class="shrink-0 text-xs text-muted-foreground">
											{formatSize(item.size)}
										</span>
									</div>
									{#if item.status === 'uploading'}
										<Progress value={item.progress} class="mt-1.5 h-1.5" />
										<span class="text-xs text-muted-foreground">{item.progress}%</span>
									{:else if item.status === 'error'}
										<p class="mt-0.5 text-xs text-destructive">{item.error}</p>
									{/if}
								</div>

								<!-- Status -->
								{#if item.status === 'done'}
									<CheckCircle class="h-4 w-4 shrink-0 text-green-500" />
								{:else if item.status === 'error'}
									<AlertCircle class="h-4 w-4 shrink-0 text-destructive" />
								{:else if item.status === 'pending'}
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={() => uploadManager.removeFile(item.id)}
										disabled={busy}
									>
										<X class="h-3.5 w-3.5" />
									</Button>
								{/if}
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			</div>
		{/if}

		<!-- All done state -->
		{#if allDone}
			<div class="flex flex-col items-center gap-4 py-6 text-center">
				<CheckCircle class="h-12 w-12 text-green-500" />
				<div>
					<p class="font-medium">All files uploaded</p>
					<p class="mt-1 text-sm text-muted-foreground">
						{files.length} file{files.length !== 1 ? 's' : ''} added to your library
					</p>
					{#if $uploadManager.lastIndexedCount > 0}
						<p class="mt-1 text-sm text-muted-foreground">
							{$uploadManager.lastIndexedCount} file{$uploadManager.lastIndexedCount === 1 ? '' : 's'} indexed
						</p>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button variant="outline" onclick={uploadManager.clearFinished}>
						Upload more
					</Button>
					<Button onclick={goBack}>
						Back to library
					</Button>
				</div>
			</div>
		{/if}

	</main>
</div>