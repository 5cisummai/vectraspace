import { describe, it, expect } from 'vitest';
import { parseAgentSseEvent } from './events';

describe('parseAgentSseEvent', () => {
	it('parses text_delta when payload includes v2 envelope fields', () => {
		const p = {
			v: 2,
			sequence: 1,
			eventId: 'ev1',
			runId: 'r1',
			workspaceId: 'w1',
			timestamp: new Date().toISOString(),
			delta: 'Hello'
		};
		const e = parseAgentSseEvent('text_delta', p);
		expect(e?.type).toBe('text_delta');
		if (e?.type === 'text_delta') expect(e.delta).toBe('Hello');
	});

	it('parses run_started with extra v2 fields', () => {
		const p = {
			v: 2,
			sequence: 0,
			eventId: 'e0',
			runId: 'run-1',
			workspaceId: 'ws-1',
			timestamp: new Date().toISOString(),
			chatId: 'c1',
			userMessageId: 'u1',
			model: 'gpt-4.1'
		};
		const e = parseAgentSseEvent('run_started', p);
		expect(e?.type).toBe('run_started');
		if (e?.type === 'run_started') {
			expect(e.chatId).toBe('c1');
			expect(e.runId).toBe('run-1');
		}
	});
});
