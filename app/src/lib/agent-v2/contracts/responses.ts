import type { AgentV2SseDataByName, SseEventName } from './events';

/**
 * Create-run returns an SSE `text/event-stream` body (not JSON).
 * Confirm returns the same.
 */
export type AgentV2CreateRunResult = {
	stream: 'sse';
	/** Suggested client path for replay (GET with sinceSequence) */
	eventsPath: string;
};

export type ParsedAgentV2Sse = {
	name: SseEventName;
	data: AgentV2SseDataByName[keyof AgentV2SseDataByName] & { v?: 2; sequence?: number; eventId?: string };
};
