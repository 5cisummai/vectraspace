<script lang="ts">
	import { onMount } from 'svelte';
	import AppTopbar from '$lib/components/app-topbar.svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { agentSessions } from '$lib/hooks/agent-sessions.svelte';
	import { workspaceStore } from '$lib/hooks/workspace.svelte';

	let { children, data } = $props();

	// Cookie-backed default for SSR/hydration; toggles update via bind:open + cookie.
	// svelte-ignore state_referenced_locally
	let sidebarOpen = $state(data.sidebarOpen);

	// Seed workspace store from server-loaded data
	$effect(() => {
		if (data.workspaces?.length) {
			workspaceStore.workspaces = data.workspaces as any;
			if (typeof window !== 'undefined') {
				const saved = localStorage.getItem('activeWorkspaceId');
				if (saved && data.workspaces.some((w: any) => w.id === saved)) {
					workspaceStore.activeId = saved;
				} else {
					workspaceStore.activeId = data.workspaces[0].id;
				}
			}
		}
	});

	onMount(() => {
		agentSessions.connect();
		return () => agentSessions.disconnect();
	});
</script>

<div class="h-screen w-full overflow-hidden bg-background text-foreground">
    <Sidebar.Provider class="h-full" bind:open={sidebarOpen}>
        <AppSidebar />

        <div class="flex h-full w-full flex-col">
            <AppTopbar>
                {#snippet left()}
                    <div class="flex items-center gap-2">
                        <Sidebar.Trigger class="-ms-1" />
                        <Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
                    </div>
                {/snippet}
            </AppTopbar>
            <div class="min-h-0 min-w-0 flex-1 overflow-auto">
                {@render children()}
            </div>
        </div>
    </Sidebar.Provider>
</div>
