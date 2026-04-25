import type { AgentInputItem } from '@openai/agents';
import type { StoredChatMessage, ToolCallSummary } from '../types';

export function sliceHistory<T>(history: T[], max: number | undefined): T[] {
	if (max === undefined || max <= 0 || history.length <= max) return history;
	return history.slice(-max);
}

export function messagesToAgentInputItems(
	messages: StoredChatMessage[] | undefined
): AgentInputItem[] {
	if (!Array.isArray(messages)) return [];
	const items: AgentInputItem[] = [];

	for (const m of messages) {
		if (m.role === 'user') {
			items.push({ role: 'user', content: m.content });
		} else if (m.role === 'assistant') {
			const toolCalls = parseToolCalls(m.toolCalls);

			if (toolCalls.length > 0) {
				for (const tc of toolCalls) {
					const callId = `hist_${tc.tool}_${items.length}`;

					items.push({
						type: 'function_call',
						name: tc.tool,
						arguments: JSON.stringify(tc.args ?? {}),
						callId
					} as AgentInputItem);

					items.push({
						type: 'function_call_result',
						callId,
						name: tc.tool,
						status: 'completed' as const,
						output: tc.resultSummary || '(no output)'
					} as unknown as AgentInputItem);
				}
			}

			items.push({
				role: 'assistant',
				status: 'completed' as const,
				content: [{ type: 'output_text' as const, text: m.content }]
			});
		}
	}
	return items;
}

function parseToolCalls(raw: unknown): ToolCallSummary[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(tc): tc is ToolCallSummary =>
			typeof tc === 'object' && tc !== null && typeof tc.tool === 'string'
	);
}
