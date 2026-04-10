import { apiFetch } from '$lib/api-fetch';

export interface WorkspaceSummary {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	role: 'ADMIN' | 'MEMBER' | 'VIEWER';
	createdAt: string;
	updatedAt: string;
	memberCount: number;
}

class WorkspaceStore {
	workspaces = $state<WorkspaceSummary[]>([]);
	activeId = $state<string | null>(null);
	loading = $state(false);

	get active(): WorkspaceSummary | undefined {
		return this.workspaces.find((w) => w.id === this.activeId);
	}

	async load() {
		this.loading = true;
		try {
			const res = await apiFetch('/api/workspaces');
			if (res.ok) {
				const data = await res.json();
				this.workspaces = data.workspaces;
				if (typeof window !== 'undefined') {
					const saved = localStorage.getItem('activeWorkspaceId');
					if (saved && this.workspaces.some((w) => w.id === saved)) {
						this.activeId = saved;
					} else if (this.workspaces.length > 0) {
						this.activeId = this.workspaces[0].id;
					}
				}
			}
		} finally {
			this.loading = false;
		}
	}

	select(id: string) {
		this.activeId = id;
		if (typeof window !== 'undefined') {
			localStorage.setItem('activeWorkspaceId', id);
		}
	}

	addWorkspace(ws: WorkspaceSummary) {
		this.workspaces.push(ws);
	}
}

export const workspaceStore = new WorkspaceStore();
