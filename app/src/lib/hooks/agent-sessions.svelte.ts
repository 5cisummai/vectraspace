/**
 * agent-sessions.svelte.ts
 *
 * Client-side reactive store for agent session statuses.
 *
 * - Maintains a `Map<chatId, 'working' | 'idle'>` updated via the SSE
 *   endpoint `/api/brain/runs/events` (server pushes on every run status change).
 * - `ChatLlm` calls `setWorking` / `setIdle` for immediate local feedback.
 * - Any component can call `getStatus(chatId)` to read live status.
 *
 * Usage:
 *   import { agentSessions } from '$lib/hooks/agent-sessions.svelte';
 *   agentSessions.connect(); // call once from the (app) layout
 *   agentSessions.getStatus(chatId); // 'working' | 'idle'
 */

import { browser } from '$app/environment';

type AgentStatus = 'working' | 'idle';

class AgentSessionsStore {
	/** Reactive map of chatId → current status. */
	#statuses = $state(new Map<string, AgentStatus>());

	#es: EventSource | null = null;
	#reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	get statuses(): ReadonlyMap<string, AgentStatus> {
		return this.#statuses;
	}

	getStatus(chatId: string): AgentStatus {
		return this.#statuses.get(chatId) ?? 'idle';
	}

	setWorking(chatId: string) {
		this.#statuses = new Map(this.#statuses).set(chatId, 'working');
	}

	setIdle(chatId: string) {
		const next = new Map(this.#statuses);
		next.delete(chatId);
		this.#statuses = next;
	}

	/** Seed multiple statuses from an initial fetch (e.g. /api/chats). */
	seedFromChats(chats: { id: string; status: AgentStatus | string }[]) {
		const next = new Map(this.#statuses);
		for (const c of chats) {
			if (c.status === 'working') {
				next.set(c.id, 'working');
			} else {
				next.delete(c.id);
			}
		}
		this.#statuses = next;
	}

	/** Open the SSE connection. Safe to call multiple times (no-ops if already open). */
	connect() {
		if (!browser || this.#es) return;

		this.#es = new EventSource('/api/brain/runs/events');

		this.#es.onmessage = (e: MessageEvent<string>) => {
			try {
				const { chatId, status } = JSON.parse(e.data) as {
					chatId: string;
					status: string;
				};
				if (status === 'queued' || status === 'running') {
					this.setWorking(chatId);
				} else {
					// done, failed, awaiting_confirmation → not "in progress"
					this.setIdle(chatId);
				}
			} catch {
				// malformed event — ignore
			}
		};

		this.#es.onerror = () => {
			this.#es?.close();
			this.#es = null;
			// Back-off reconnect
			if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = setTimeout(() => {
				this.#reconnectTimer = null;
				this.connect();
			}, 5_000);
		};
	}

	disconnect() {
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		this.#es?.close();
		this.#es = null;
	}
}

export const agentSessions = new AgentSessionsStore();
