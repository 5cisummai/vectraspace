<script lang="ts">
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PanelLeftCloseIcon from '@lucide/svelte/icons/panel-left-close';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PanelLeftOpenIcon from '@lucide/svelte/icons/panel-left-open';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import { onMount, tick } from 'svelte';
	import ChatLlm from '$lib/components/chat-llm/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	interface AgentSummary {
		id: string;
		title: string;
		createdAt: string;
		updatedAt: string;
		messageCount: number;
		status: 'idle' | 'working' | 'done';
	}

	let agents = $state<AgentSummary[]>([]);
	let activeAgentId = $state<string | null>(null);
	let activeAgentStatus = $state<'idle' | 'working' | 'done'>('idle');
	let loadingAgents = $state(false);
	let agentSidebarOpen = $state(true);
	let error = $state<string | null>(null);
	let agentPanel = $state<ChatLlm | null>(null);

	async function fetchAgents(preferredAgentId?: string): Promise<void> {
		loadingAgents = true;
		try {
			const response = await fetch('/api/chats');
			if (!response.ok) {
				throw new Error(`Failed to load agents (${response.status})`);
			}
			const payload = (await response.json()) as { chats?: AgentSummary[] };
			agents = Array.isArray(payload.chats) ? payload.chats : [];
			if (preferredAgentId) {
				activeAgentId = preferredAgentId;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load agents';
		} finally {
			loadingAgents = false;
		}
	}

	function startNewAgent() {
		agentPanel?.resetConversation();
	}

	async function selectAgent(agentId: string) {
		await agentPanel?.loadConversationFromServer(agentId);
	}

	function relativeTimestamp(iso: string): string {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const diff = Date.now() - date.getTime();
		const minute = 60_000;
		const hour = 60 * minute;
		const day = 24 * hour;
		if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`;
		if (diff < day) return `${Math.floor(diff / hour)}h ago`;
		return `${Math.floor(diff / day)}d ago`;
	}

	onMount(() => {
		void (async () => {
			await fetchAgents();
			await tick();
			if (agents.length > 0) {
				await agentPanel?.loadConversationFromServer(agents[0].id);
			}
		})();
	});

	function getAgentStatus(agentId: string): 'idle' | 'working' | 'done' {
		if (agentId === activeAgentId) {
			return activeAgentStatus;
		}
		const agent = agents.find(a => a.id === agentId);
		return agent?.status ?? 'idle';
	}
</script>

<div class="flex h-full min-h-0 w-full flex-col bg-background">
	<Sidebar.Provider class="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1">
		{#if agentSidebarOpen}
			<Sidebar.Root
				class="hidden h-full min-h-0 w-72 shrink-0 border-r border-border/60 bg-muted/20 md:flex"
				collapsible="none"
			>
				<Sidebar.Header class="border-b border-sidebar-border/60">
					<div class="flex items-center justify-between px-1 py-1">
						<h2 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Agents</h2>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							class="h-7 w-7"
							aria-label="Close agents sidebar"
							onclick={() => (agentSidebarOpen = false)}
						>
							<PanelLeftCloseIcon class="size-4" />
						</Button>
					</div>
					<div class="pb-2">
						<Button
							variant="outline"
							size="sm"
							class="w-full justify-start gap-2"
							onclick={startNewAgent}
						>
							<PlusIcon class="size-3.5" />
							New agent
						</Button>
					</div>
				</Sidebar.Header>
				<Sidebar.Content class="[scrollbar-gutter:stable] flex-1 min-h-0 overflow-y-auto p-2">
					{#if loadingAgents && agents.length === 0}
						<p class="px-2 py-1 text-xs text-muted-foreground">Loading agents…</p>
					{:else if agents.length === 0}
						<p class="px-2 py-1 text-xs text-muted-foreground">No saved agents yet.</p>
					{:else}
						<Sidebar.Menu class="space-y-1">
							{#each agents as agent (agent.id)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton
										variant={agent.id === activeAgentId ? 'outline' : 'default'}
										class="h-auto items-start py-2"
										isActive={agent.id === activeAgentId}
										onclick={() => selectAgent(agent.id)}
									>
										<div class="flex items-center gap-2">
											{#if getAgentStatus(agent.id) === 'working'}
												<LoaderIcon class="size-4 animate-spin text-muted-foreground" />
											{:else if getAgentStatus(agent.id) === 'done'}
												<CheckCircleIcon class="size-4 text-green-500" />
											{:else}
												<CircleIcon class="size-4 text-muted-foreground/50" />
											{/if}
											<span class="truncate text-sm font-medium">{agent.title}</span>
										</div>
										<span
											class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"
										>
											<MessageSquareIcon class="size-3" />
											<span>{agent.messageCount}</span>
											<span>·</span>
											<span>{relativeTimestamp(agent.updatedAt)}</span>
										</span>
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					{/if}
				</Sidebar.Content>
			</Sidebar.Root>
		{/if}

		<div class="relative flex h-full min-h-0 flex-1">
			{#if !agentSidebarOpen}
				<div class="absolute top-3 left-3 z-20">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						class="h-8 w-8 border-border/60 bg-background/90 shadow-sm backdrop-blur"
						aria-label="Open agents sidebar"
						onclick={() => (agentSidebarOpen = true)}
					>
						<PanelLeftOpenIcon class="size-4" />
					</Button>
				</div>
			{/if}
			<ChatLlm
				bind:this={agentPanel}
				bind:activeChatId={activeAgentId}
				bind:activeAgentStatus
				onListRefresh={() => fetchAgents(activeAgentId ?? undefined)}
			/>
		</div>
	</Sidebar.Provider>

	{#if error}
		<div
			class="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300"
		>
			{error}
		</div>
	{/if}
</div>

