<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		HardDrive,
		AlertCircle,
		CheckCircle,
		RefreshCw,
		Users,
		Check,
		X,
		Info
	} from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Tabs from '$lib/components/ui/tabs';
	import AppTopbar from '$lib/components/app-topbar.svelte';
	import UserRosterTable from './user-roster-table.svelte';
	import type { DriveInfo } from '../../api/storage/+server';
	import { resolve } from '$app/paths';

	let activeTab = $state<'storage' | 'users' | 'info'>('storage');
	let drives = $state<DriveInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Admin state
	const isAdmin = $derived(
		typeof localStorage !== 'undefined' && localStorage.getItem('role') === 'ADMIN'
	);
	type PendingUser = { id: string; username: string; displayName: string; createdAt: string };
	type UserSummary = {
		id: string;
		username: string;
		displayName: string;
		role: 'ADMIN' | 'USER';
		approved: boolean;
		createdAt: string;
	};
	let pendingUsers = $state<PendingUser[]>([]);
	let users = $state<UserSummary[]>([]);
	let pendingLoading = $state(false);
	let usersLoading = $state(false);
	let pendingError = $state<string | null>(null);
	let usersError = $state<string | null>(null);

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
			const token = localStorage.getItem('accessToken') ?? '';
			const res = await fetch('/api/storage', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error(await res.text());
			drives = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load storage info';
		} finally {
			loading = false;
		}
	}

	async function loadPending() {
		pendingLoading = true;
		pendingError = null;
		try {
			const token = localStorage.getItem('accessToken') ?? '';
			const res = await fetch('/api/auth/pending', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error(await res.text());
			pendingUsers = await res.json();
		} catch (e) {
			pendingError = e instanceof Error ? e.message : 'Failed to load pending users';
		} finally {
			pendingLoading = false;
		}
	}

	async function loadUsers() {
		usersLoading = true;
		usersError = null;
		try {
			const token = localStorage.getItem('accessToken') ?? '';
			const res = await fetch('/api/auth/users', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) throw new Error(await res.text());
			users = await res.json();
		} catch (e) {
			usersError = e instanceof Error ? e.message : 'Failed to load user list';
		} finally {
			usersLoading = false;
		}
	}

	async function approveUser(userId: string) {
		const token = localStorage.getItem('accessToken') ?? '';
		const res = await fetch('/api/auth/approve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ userId })
		});
		if (res.ok) pendingUsers = pendingUsers.filter((u) => u.id !== userId);
	}

	async function rejectUser(userId: string) {
		const token = localStorage.getItem('accessToken') ?? '';
		const res = await fetch('/api/auth/approve', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ userId })
		});
		if (res.ok) pendingUsers = pendingUsers.filter((u) => u.id !== userId);
	}

	let reindexLoading = $state(false);
	let reindexMessage = $state<string | null>(null);

	async function runReindex() {
		reindexLoading = true;
		reindexMessage = null;
		try {
			const token = localStorage.getItem('accessToken') ?? '';
			const res = await fetch('/api/search/reindex', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) {
				throw new Error(await res.text());
			}
			const data = await res.json();
			reindexMessage = data?.summary ? 'Reindex completed successfully.' : 'Reindex request succeeded.';
		} catch (e) {
			reindexMessage = e instanceof Error ? e.message : 'Failed to trigger reindex';
		} finally {
			reindexLoading = false;
		}
	}

	onMount(() => {
		loadDrives();
		if (localStorage.getItem('role') === 'ADMIN') {
			loadPending();
			loadUsers();
		}
	});
</script>

<div class="min-h-screen bg-background text-foreground">
	<AppTopbar>
		{#snippet left()}
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => goto(resolve('/'))}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Separator orientation="vertical" class="h-5" />
		{/snippet}

		{#snippet center()}
			<span class="text-lg font-semibold">Settings</span>
		{/snippet}
	</AppTopbar>

	<main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
		<Tabs.Root
			value={activeTab}
			onValueChange={(v) => (activeTab = v as 'storage' | 'users' | 'info')}
		>
			<Tabs.List class="grid w-full {isAdmin ? 'grid-cols-3' : 'grid-cols-2'}">
				<Tabs.Trigger value="storage" class="flex items-center gap-2">
					<HardDrive class="h-4 w-4" />
					Storage
				</Tabs.Trigger>
				{#if isAdmin}
					<Tabs.Trigger value="users" class="relative flex items-center justify-center gap-2">
						<Users class="h-4 w-4" />
						Users
						{#if pendingUsers.length > 0}
							<Badge variant="destructive" class="absolute -top-2 -right-2 text-[10px]"
								>{pendingUsers.length}</Badge
							>
						{/if}
					</Tabs.Trigger>
				{/if}
				<Tabs.Trigger value="info" class="flex items-center gap-2">
					<Info class="h-4 w-4" />
					Info
				</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="storage" class="space-y-6">
				<!-- Error -->
				{#if error}
					<div
						class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
					>
						<AlertCircle class="h-4 w-4 shrink-0" />
						{error}
					</div>
				{/if}

				<!-- How to add drives info box -->
				{#if isAdmin}
					<Card.Root>
						<Card.Header>
							<Card.Title class="text-base">Adding or removing drives</Card.Title>
							<Card.Description>
								Storage pools are configured via the <code
									class="rounded bg-muted px-1 py-0.5 font-mono text-xs">MEDIA_ROOTS</code
								>
								environment variable. Edit your
								<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env</code> file and restart
								the server to apply changes.
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="rounded-lg bg-muted px-4 py-3 font-mono text-sm">
								MEDIA_ROOTS=/mnt/drive1,/mnt/drive2,/mnt/drive3
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				<!-- Drive list -->
				<div class="flex flex-col gap-3">
<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
					Configured drives ({drives.length})
				</h2>
				<div class="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onclick={loadDrives} disabled={loading}>
						<RefreshCw class="mr-2 h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
						Refresh
					</Button>
					{#if isAdmin}
						<Button variant="secondary" size="sm" onclick={runReindex} disabled={reindexLoading}>
							<RefreshCw class="mr-2 h-3.5 w-3.5 {reindexLoading ? 'animate-spin' : ''}" />
							Reindex
						</Button>
					{/if}
				</div>
			</div>
			{#if reindexMessage}
				<div class="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
					{reindexMessage}
				</div>
			{/if}

					{#if loading}
						{#each [1, 2] as i (i)}
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
							<div class={drive.available ? '' : 'opacity-60'}>
								<Card.Root>
									<Card.Content class="px-6 py-4">
										<div class="flex items-start gap-4">
											<div
												class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"
											>
												<HardDrive
													class="h-5 w-5 {drive.available
														? 'text-primary'
														: 'text-muted-foreground'}"
												/>
											</div>

											<div class="flex min-w-0 flex-1 flex-col gap-3">
												<!-- Header row -->
												<div class="flex items-center justify-between gap-2">
													<div class="min-w-0">
														<div class="flex items-center gap-2">
															<span class="truncate font-medium">{drive.name}</span>
															<Badge variant="outline" class="font-mono text-[10px]">
																drive {drive.index}
															</Badge>
														</div>
														<p class="mt-0.5 truncate font-mono text-xs text-muted-foreground">
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
														<div
															class="flex items-center justify-between text-xs text-muted-foreground"
														>
															<span>
																<span class={getUsageColor(drive.usedPercent)}>
																	{formatSize(drive.usedBytes)} used
																</span>
																of {formatSize(drive.totalBytes)}
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
							</div>
						{/each}
					{/if}
				</div>

				<!-- RAID info -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">RAID & redundancy</Card.Title>
						<Card.Description>
							This app treats each path in MEDIA_ROOTS as an independent drive. For redundancy,
							configure RAID at the OS level and point MEDIA_ROOTS at the resulting mount point.
						</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-2 text-sm text-muted-foreground">
						<p>Recommended approaches:</p>
						<ul class="ml-4 flex list-disc flex-col gap-1">
							<li>
								<strong class="text-foreground">Linux:</strong> mdadm for hardware RAID, or mergerfs to
								pool drives without redundancy
							</li>
							<li>
								<strong class="text-foreground">ZFS:</strong> zpool with mirror or raidz for redundancy
								+ compression
							</li>
							<li>
								<strong class="text-foreground">Windows:</strong> Storage Spaces with a mirror or parity
								layout
							</li>
							<li>
								<strong class="text-foreground">macOS:</strong> Disk Utility RAID sets or SoftRAID
							</li>
						</ul>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>


				<Tabs.Content value="users" class="space-y-3">
				{#if isAdmin}
					<div class="flex items-center justify-between">
						<h2
							class="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase"
						>
							Pending approvals
						</h2>
						<Button variant="outline" size="sm" onclick={loadPending} disabled={pendingLoading}>
							<RefreshCw class="mr-2 h-3.5 w-3.5 {pendingLoading ? 'animate-spin' : ''}" />
							Refresh
						</Button>
					</div>

					{#if pendingError}
						<div
							class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
						>
							<AlertCircle class="h-4 w-4 shrink-0" />
							{pendingError}
						</div>
					{/if}

					{#if pendingLoading}
						{#each [1, 2] as i (i)}
							<Skeleton class="h-16 rounded-xl" />
						{/each}
					{:else if pendingUsers.length === 0}
						<Card.Root>
							<Card.Content class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
								<CheckCircle class="h-8 w-8 opacity-30" />
								<p class="text-sm">No pending signups</p>
							</Card.Content>
						</Card.Root>
					{:else}
						{#each pendingUsers as user (user.id)}
							<Card.Root>
								<Card.Content class="flex items-center justify-between gap-4 px-5 py-4">
									<div class="min-w-0">
										<p class="truncate font-medium">{user.displayName}</p>
										<p class="font-mono text-xs text-muted-foreground">@{user.username}</p>
										<p class="text-xs text-muted-foreground">
											Registered {new Date(user.createdAt).toLocaleDateString()}
										</p>
									</div>
									<div class="flex shrink-0 gap-2">
										<Button
											size="sm"
											variant="outline"
											class="border-green-500 text-green-600 hover:bg-green-50"
											onclick={() => approveUser(user.id)}
										>
											<Check class="mr-1.5 h-3.5 w-3.5" />
											Approve
										</Button>
										<Button
											size="sm"
											variant="outline"
											class="border-destructive/50 text-destructive hover:bg-destructive/10"
											onclick={() => rejectUser(user.id)}
										>
											<X class="mr-1.5 h-3.5 w-3.5" />
											Reject
										</Button>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					{/if}
				{/if}
					<div class="pt-6">
						<div class="flex items-center justify-between">
							<h2
								class="flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase"
							>
								<Users class="h-4 w-4" />
								User roster
							</h2>
							<Button variant="outline" size="sm" onclick={loadUsers} disabled={usersLoading}>
								<RefreshCw class="mr-2 h-3.5 w-3.5 {usersLoading ? 'animate-spin' : ''}" />
								Refresh
							</Button>
						</div>

						{#if usersError}
							<div
								class="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
							>
								<AlertCircle class="h-4 w-4 shrink-0" />
								{usersError}
							</div>
						{/if}

						{#if usersLoading}
							{#each [1, 2, 3] as i (i)}
								<Skeleton class="h-16 rounded-xl" />
							{/each}
						{:else if users.length === 0}
							<Card.Root>
								<Card.Content class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
									<CheckCircle class="h-8 w-8 opacity-30" />
									<p class="text-sm">No users found</p>
								</Card.Content>
							</Card.Root>
						{:else}
							<UserRosterTable users={users} />
						{/if}
					</div>
				</Tabs.Content>

			<Tabs.Content value="info" class="space-y-4">
				<!-- Build info -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">About this server</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col gap-4 text-sm">
						<div class="flex items-center justify-between border-b border-border py-2">
							<span class="text-muted-foreground">Application</span>
							<span class="font-medium">Media Server</span>
						</div>
						<div class="flex items-center justify-between border-b border-border py-2">
							<span class="text-muted-foreground">Version</span>
							<span class="font-mono font-medium">v1.0.0</span>
						</div>
						<div class="flex items-center justify-between border-b border-border py-2">
							<span class="text-muted-foreground">Build Date</span>
							<span class="font-medium">{new Date().toLocaleDateString()}</span>
						</div>
						<div class="flex items-center justify-between py-2">
							<span class="text-muted-foreground">Node Environment</span>
							<Badge variant="outline">development</Badge>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Legal -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base">Legal</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col gap-4 text-sm text-muted-foreground">
						<div>
							<p class="mb-2 font-medium text-foreground">License</p>
							<p>
								This application is provided as-is. Ensure compliance with local laws regarding
								media storage and access.
							</p>
						</div>
						<Separator />
						<div>
							<p class="mb-2 font-medium text-foreground">Data Privacy</p>
							<p>
								This server stores user credentials securely using argon2 hashing. Access is
								controlled via JWT authentication. No data is shared with third parties.
							</p>
						</div>
						<Separator />
						<div>
							<p class="mb-2 font-medium text-foreground">Third-party Libraries</p>
							<p>
								This application uses open-source libraries including Svelte, SvelteKit, Prisma, and
								others. See package.json and node_modules for licensing information.
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		</Tabs.Root>
	</main>
</div>
