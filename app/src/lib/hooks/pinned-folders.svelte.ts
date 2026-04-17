import { browser } from '$app/environment';

const STORAGE_KEY = 'pinned-folders';

export interface PinnedFolder {
	path: string;
	name: string;
	pinnedAt: string;
}

function load(): PinnedFolder[] {
	if (!browser) return [];
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PinnedFolder[];
	} catch {
		return [];
	}
}

function save(folders: PinnedFolder[]) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

class PinnedFoldersStore {
	items = $state<PinnedFolder[]>([]);

	constructor() {
		if (browser) {
			this.items = load();
		}
	}

	pin(path: string, name: string) {
		if (this.items.some((f) => f.path === path)) return;
		this.items = [...this.items, { path, name, pinnedAt: new Date().toISOString() }];
		save(this.items);
	}

	unpin(path: string) {
		this.items = this.items.filter((f) => f.path !== path);
		save(this.items);
	}

	isPinned(path: string): boolean {
		return this.items.some((f) => f.path === path);
	}
}

export const pinnedFolders = new PinnedFoldersStore();
