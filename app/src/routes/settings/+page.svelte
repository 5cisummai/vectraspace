<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		HardDrive,
		AlertCircle,
		CheckCircle,
		RefreshCw,
		Server
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { DriveInfo } from '../api/storage/+server';

	let drives = $state<DriveInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
		return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	}

	function getUsageColor(percent: number) {
		if (percent >= 90) return 'text-destructive';
		if (percent >= 75) return 'text-amber-500';
		return 'text-green-500';
	}

	async function loadDrives() {
		loading = true;
		error = null;
		try {
			const res = await fetch('/api/storage');
			if (!res.ok) throw new Error(await res.text());
			drives = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load storage info';
		} finally {
			loading = false;
		}
	}

	onMount(() => loadDrives());
</script>

<div class="min-h-screen bg-background text-foreground">
	<!-- Topbar -->
	<header class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => goto('/')}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Separator orientation="vertical" class="h-5" />
			<Server class="h-4 w-4 text-muted-foreground" />
			<span class="flex-1 font-medium">Storage settings</span>
			<Button variant="outline" size="sm" onclick={loadDrives} disabled={loading}>
				<RefreshCw class="mr-2 h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">

		<!-- Error -->
		{#if error}
			<div class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				<AlertCircle class="h-4 w-4 shrink-0" />
				{error}
			</div>
		{/if}

		<!-- How to add drives info box -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Adding or removing drives</Card.Title>
				<Card.Description>
					Storage pools are configured via the <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">MEDIA_ROOTS</code> environment variable.
					Edit your <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env</code> file and restart the server to apply changes.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="rounded-lg bg-muted px-4 py-3 font-mono text-sm">
					MEDIA_ROOTS=/mnt/drive1,/mnt/drive2,/mnt/drive3
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Drive list -->
		<div class="flex flex-col gap-3">
			<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">
				Configured drives ({drives.length})
			</h2>

			{#if loading}
				{#each Array(2) as _, i (i)}
					<Skeleton class="h-36 rounded-xl" />
				{/each}

			{:else if drives.length === 0}
				<Card.Root>
					<Card.Content class="flex flex-col items-center gap-3 py-12 text-muted-foreground">
						<HardDrive class="h-10 w-10 opacity-30" />
						<p class="text-sm">No drives configured</p>
						<p class="text-xs">Set MEDIA_ROOTS in your .env file</p>
					</Card.Content>
				</Card.Root>

			{:else}
				{#each drives as drive (drive.index)}
					<Card.Root class="{!drive.available ? 'opacity-60' : ''}">
						<Card.Content class="px-6 py-4">
							<div class="flex items-start gap-4">
								<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
									<HardDrive class="h-5 w-5 {drive.available ? 'text-primary' : 'text-muted-foreground'}" />
								</div>

								<div class="min-w-0 flex-1 flex flex-col gap-3">
									<!-- Header row -->
									<div class="flex items-center justify-between gap-2">
										<div class="min-w-0">
											<div class="flex items-center gap-2">
												<span class="font-medium truncate">{drive.name}</span>
												<Badge variant="outline" class="font-mono text-[10px]">
													drive {drive.index}
												</Badge>
											</div>
											<p class="mt-0.5 truncate text-xs text-muted-foreground font-mono">
												{drive.path}
											</p>
										</div>
										{#if drive.available}
											<CheckCircle class="h-4 w-4 shrink-0 text-green-500" />
										{:else}
											<div class="flex items-center gap-1.5 text-destructive">
												<AlertCircle class="h-4 w-4 shrink-0" />
												<span class="text-xs">Unavailable</span>
											</div>
										{/if}
									</div>

									<!-- Usage bar -->
									{#if drive.available && drive.totalBytes && drive.usedBytes !== undefined && drive.freeBytes !== undefined && drive.usedPercent !== undefined}
										<div class="flex flex-col gap-1.5">
											<Progress value={drive.usedPercent} class="h-2" />
											<div class="flex items-center justify-between text-xs text-muted-foreground">
												<span>
													<span class={getUsageColor(drive.usedPercent)}>
														{formatSize(drive.usedBytes)} used
													</span>
													{' '}of {formatSize(drive.totalBytes)}
												</span>
												<span>{formatSize(drive.freeBytes)} free</span>
											</div>
										</div>
									{:else if !drive.available}
										<p class="text-xs text-muted-foreground">
											Could not read drive — check that the path exists and is accessible.
										</p>
									{/if}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
		</div>

		<!-- RAID info -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">RAID & redundancy</Card.Title>
				<Card.Description>
					This app treats each path in MEDIA_ROOTS as an independent drive.
					For redundancy, configure RAID at the OS level and point MEDIA_ROOTS at the resulting mount point.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-2 text-sm text-muted-foreground">
				<p>Recommended approaches:</p>
				<ul class="ml-4 flex flex-col gap-1 list-disc">
					<li><strong class="text-foreground">Linux:</strong> mdadm for hardware RAID, or mergerfs to pool drives without redundancy</li>
					<li><strong class="text-foreground">ZFS:</strong> zpool with mirror or raidz for redundancy + compression</li>
					<li><strong class="text-foreground">Windows:</strong> Storage Spaces with a mirror or parity layout</li>
					<li><strong class="text-foreground">macOS:</strong> Disk Utility RAID sets or SoftRAID</li>
				</ul>
			</Card.Content>
		</Card.Root>

	</main>
</div>