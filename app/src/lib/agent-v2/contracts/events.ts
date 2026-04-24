/**
 * Agent V2 — canonical SSE / replay event types (frontend-agnostic, no Svelte imports).
 * Wire format: `event: <SseEventName>\\ndata: JSON\\n\\n` where JSON matches AgentV2SseDataByName[SseEventName] & AgentV2Envelope.
 */

export const AGENT_V2_WIRE = 2 as const;

export type AgentV2Envelope = {
	/** Wire protocol version */
	v: typeof AGENT_V2_WIRE;
	/** Monotonic per-run sequence (for ordering and `sinceSequence` replay) */
	sequence: number;
	eventId: string;
	runId: string;
	workspaceId: string;
	timestamp: string;
};

export type SseEventName =
	| 'run_started'
	| 'text_delta'
	| 'reasoning'
	| 'tool_start'
	| 'tool_done'
	| 'confirmation'
	| 'meta'
	| 'error'
	| 'done';

export type AgentV2SseDataByName = {
	run_started: {
		chatId: string;
		userMessageId?: string;
	};
	text_delta: { delta: string };
	reasoning: { text: string };
	tool_start: { tool: string; args: Record<string, unknown> };
	tool_done: { tool?: string; result?: string };
	confirmation: {
		pendingId: string;
		tool: string;
		args: Record<string, unknown>;
		chatId: string;
		requestedByUserId: string;
	};
	meta: {
		chatId?: string;
		messageId?: string;
		sources?: { kind: string; id?: string; path?: string; label?: string }[];
		toolCalls?: { tool: string; args: Record<string, unknown>; resultSummary: string }[];
		model?: string;
		iterations?: number;
	};
	error: { message: string };
	done: Record<string, never>;
};

export type AgentV2StreamPayload<K extends SseEventName = SseEventName> = K extends infer Name
	? Name extends SseEventName
		? AgentV2Envelope & AgentV2SseDataByName[Name]
		: never
	: never;
