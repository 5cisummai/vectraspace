import type { AskFilters } from '$lib/server/agent-v2/types';

export type CreateAgentV2RunBody = {
	question: string;
	chatId?: string;
	regenerate?: boolean;
	maxHistoryMessages?: number;
	filters?: AskFilters;
	/** Merged on server with stored prefs and server allowlist */
	autoApproveToolNames?: string[];
};

export type AgentV2ConfirmBody = {
	pendingId: string;
	chatId: string;
	approved: boolean;
	/** Merged on server (same as ask) */
	autoApproveToolNames?: string[];
};
