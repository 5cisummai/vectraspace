// ---------------------------------------------------------------------------
// V2 transport — @openai/agents streaming with versioned SSE + DB replay rows
// ---------------------------------------------------------------------------

import { run, RunState } from '@openai/agents';
import type {
	StreamedRunResult,
	RunStreamEvent,
	AgentInputItem,
	RunItemStreamEvent,
	RunRawModelStreamEvent
} from '@openai/agents';
import { env } from '$env/dynamic/private';
import { getMediaAgent } from '$lib/server/agent/agent';
import { createPendingConfirmation } from '$lib/server/pending-tool-confirmation';
import { saveAssistantMessage } from '$lib/server/chat-store';
import {
	createAgentRun,
	markRunRunning,
	markRunDone,
	markRunFailed,
	supersedeOtherRunsForChat,
	emitRunStep
} from '$lib/server/agent-runs';
import type { AgentAppContext } from '$lib/server/agent/context';
import type { AgentRequest } from '$lib/server/agent/types';
import { MAX_AGENT_ITERATIONS } from '$lib/server/agent/types';
import { messagesToAgentInputItems } from '$lib/server/agent/memory/history';
import { normalizeFilters } from '$lib/server/agent/filters';
import { errorMessage } from '$lib/server/agent/errors';
import { getAgentModel } from '$lib/server/agent/provider';
import { newEventId, createRunEventSequencer, persistV2SseEvent } from './run-events';

function sseEvent(event: string, data: unknown): string {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export type StreamRunOptsV2 = {
	chatId: string;
	kind: 'ask' | 'confirm';
	savedUserMessageId?: string | null;
	/** Effective workspace (resolved; may be default when workspaces are disabled) */
	workspaceId: string;
};

type BaseWriter = (event: string, data: unknown) => void;

type SSEWriter = (event: string, data: unknown) => void;

function wrapSseV2(
	base: BaseWriter,
	runId: string,
	workspaceId: string,
	nextSeq: () => number
): SSEWriter {
	return (event, data) => {
		const body = (typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}) as
			| Record<string, unknown>
			| { message: string };
		const sequence = nextSeq();
		const payload: Record<string, unknown> = {
			v: 2,
			sequence,
			eventId: newEventId(),
			runId,
			workspaceId,
			timestamp: new Date().toISOString(),
			...body
		};
		persistV2SseEvent(runId, event, payload);
		base(event, payload);
	};
}

/**
 * Optional workspace id in opts for collaboration fan-out (server uses appCtx.workspaceId in tools).
 * Envelope `workspaceId` is always opts.workspaceId.
 */
export function createV2StreamingResponse(
	request: AgentRequest,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2
): Response {
	const encoder = new TextEncoder();

	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const baseWrite: BaseWriter = (event, data) => {
				try {
					controller.enqueue(encoder.encode(sseEvent(event, data)));
				} catch {
					// closed
				}
			};

			const nextSeq = createRunEventSequencer();
			let w: BaseWriter = baseWrite;

			try {
				await executeV2Run(request, appCtx, opts, (ev, d) => w(ev, d), (rid) => {
					w = wrapSseV2(baseWrite, rid, opts.workspaceId, nextSeq) as BaseWriter;
				});
			} catch (err) {
				w('error', { message: errorMessage(err) } as object);
			} finally {
				w('done', {} as object);
				try {
					controller.close();
				} catch {
					// already closed
				}
			}
		}
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
			'X-Agent-Transport': 'v2'
		}
	});
}

export function createV2ConfirmStreamingResponse(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	runState: RunState<any, any>,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2
): Response {
	const encoder = new TextEncoder();

	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const baseWrite: BaseWriter = (event, data) => {
				try {
					controller.enqueue(encoder.encode(sseEvent(event, data)));
				} catch {
					// closed
				}
			};

			const nextSeq = createRunEventSequencer();
			let w: BaseWriter = baseWrite;

			try {
				await executeV2Confirm(
					runState,
					appCtx,
					opts,
					(ev, d) => w(ev, d),
					(rid) => {
						w = wrapSseV2(baseWrite, rid, opts.workspaceId, nextSeq) as BaseWriter;
					}
				);
			} catch (err) {
				w('error', { message: errorMessage(err) } as object);
			} finally {
				w('done', {} as object);
				try {
					controller.close();
				} catch {
					// already closed
				}
			}
		}
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
			'X-Agent-Transport': 'v2'
		}
	});
}

// ---------------------------------------------------------------------------
// execute (mirrors stream.ts; write is plain until runId is set)
// ---------------------------------------------------------------------------

async function executeV2Run(
	request: AgentRequest,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2,
	write: SSEWriter,
	setRunId: (id: string) => void
): Promise<void> {
	const filters = normalizeFilters(request.filters);
	appCtx.filters = filters;

	const historyItems = messagesToAgentInputItems(request.history);
	const input: AgentInputItem[] = [
		...historyItems,
		{ role: 'user', content: request.question.trim() }
	];

	const agent = getMediaAgent();
	const agentRun = await createAgentRun(appCtx.userId, opts.chatId, opts.kind, appCtx.workspaceId);
	if (opts.kind === 'confirm') {
		await supersedeOtherRunsForChat(opts.chatId, agentRun.id);
	}
	await markRunRunning(agentRun.id);
	setRunId(agentRun.id);

	const model = env.LLM_MODEL ?? getAgentModel();
	write('run_started', {
		runId: agentRun.id,
		chatId: opts.chatId,
		model,
		...(opts.savedUserMessageId ? { userMessageId: opts.savedUserMessageId } : {})
	});

	appCtx.logger.info('stream_run.v2.start', { chatId: opts.chatId, runId: agentRun.id });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let stream: StreamedRunResult<AgentAppContext, any>;
	try {
		stream = (await run(agent, input, {
			context: appCtx,
			maxTurns: MAX_AGENT_ITERATIONS,
			stream: true
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		})) as StreamedRunResult<AgentAppContext, any>;
	} catch (err) {
		await markRunFailed(agentRun.id, errorMessage(err));
		throw err;
	}

	await processV2StreamEvents(stream, appCtx, opts, write, agentRun.id, model);
}

async function executeV2Confirm(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	runState: RunState<any, any>,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2,
	write: SSEWriter,
	setRunId: (id: string) => void
): Promise<void> {
	const agent = getMediaAgent();
	const model = env.LLM_MODEL ?? getAgentModel();
	const agentRun = await createAgentRun(appCtx.userId, opts.chatId, 'confirm', appCtx.workspaceId);
	await supersedeOtherRunsForChat(opts.chatId, agentRun.id);
	await markRunRunning(agentRun.id);
	setRunId(agentRun.id);

	write('run_started', { runId: agentRun.id, chatId: opts.chatId, model });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let stream: StreamedRunResult<AgentAppContext, any>;
	try {
		stream = (await run(agent, runState, {
			context: appCtx,
			maxTurns: MAX_AGENT_ITERATIONS,
			stream: true
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		})) as StreamedRunResult<AgentAppContext, any>;
	} catch (err) {
		await markRunFailed(agentRun.id, errorMessage(err));
		throw err;
	}

	await processV2StreamEvents(stream, appCtx, opts, write, agentRun.id, model);
}

async function processV2StreamEvents(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	stream: StreamedRunResult<AgentAppContext, any>,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2,
	write: SSEWriter,
	runId: string,
	model: string
): Promise<void> {
	let accumulatedText = '';
	try {
		for await (const event of stream) {
			mapRawStreamEvent(event, appCtx, opts, write, runId);
			if (event.type === 'raw_model_stream_event') {
				const delta = extractTextDelta(event);
				if (delta) accumulatedText += delta;
			}
		}
		await stream.completed;

		if (stream.interruptions && stream.interruptions.length > 0) {
			const interruption = stream.interruptions[0];
			const toolName = interruption.name ?? 'unknown_tool';
			let toolArgs: Record<string, unknown> = {};
			try {
				if (
					'arguments' in interruption.rawItem &&
					typeof interruption.rawItem.arguments === 'string'
				) {
					toolArgs = JSON.parse(interruption.rawItem.arguments) as Record<string, unknown>;
				}
			} catch {
				// ignore
			}

			const runStateStr = stream.state.toString();
			const pendingId = await createPendingConfirmation(appCtx.userId, appCtx.chatId, {
				runState: runStateStr,
				toolName,
				toolArgs
			});

			write('confirmation', {
				pendingId,
				tool: toolName,
				args: toolArgs,
				chatId: opts.chatId,
				requestedByUserId: appCtx.userId
			});
			appCtx.logger.info('stream_run.v2.pending', { runId, pendingId, tool: toolName });
			const { markRunAwaitingConfirmation } = await import('$lib/server/agent-runs');
			await markRunAwaitingConfirmation(runId, {
				pendingId,
				tool: toolName,
				args: toolArgs,
				chatId: opts.chatId
			});
			return;
		}

		const finalText =
			(typeof stream.finalOutput === 'string' ? stream.finalOutput : null) ??
			(accumulatedText || null);
		const answer =
			finalText ??
			"I couldn't complete the request within the tool-iteration limit. Please try a narrower question.";

		const iterations =
			stream.newItems.filter((i) => i.type === 'tool_call_item' || i.type === 'message_output_item')
				.length || 1;

		const msgId = await saveAssistantMessage(
			opts.chatId,
			answer,
			{
				sources: appCtx.sourceTracker.toArray(),
				toolCalls: appCtx.toolCalls,
				model,
				iterations
			},
			appCtx.workspaceId
		);

		write('meta', {
			chatId: opts.chatId,
			sources: appCtx.sourceTracker.toArray(),
			toolCalls: appCtx.toolCalls,
			model,
			iterations,
			messageId: msgId
		});

		await markRunDone(runId);
		appCtx.logger.info('stream_run.v2.complete', { runId, iterations });
	} catch (err) {
		await markRunFailed(runId, errorMessage(err));
		throw err;
	}
}

function mapRawStreamEvent(
	event: RunStreamEvent,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2,
	write: SSEWriter,
	runId: string
): void {
	switch (event.type) {
		case 'raw_model_stream_event': {
			const delta = extractTextDelta(event);
			if (delta) write('text_delta', { delta } as object);
			break;
		}
		case 'run_item_stream_event': {
			mapRunItemEvent(event, appCtx, opts, write, runId);
			break;
		}
		case 'agent_updated_stream_event': {
			break;
		}
	}
}

function mapRunItemEvent(
	event: RunItemStreamEvent,
	appCtx: AgentAppContext,
	opts: StreamRunOptsV2,
	write: SSEWriter,
	runId: string
): void {
	const { name, item } = event;
	switch (name) {
		case 'tool_called': {
			const toolName = 'name' in item.rawItem ? String(item.rawItem.name ?? '') : 'unknown';
			let toolArgs: Record<string, unknown> = {};
			try {
				if ('arguments' in item.rawItem && typeof item.rawItem.arguments === 'string') {
					toolArgs = JSON.parse(item.rawItem.arguments) as Record<string, unknown>;
				}
			} catch {
				// ignore
			}
			write('tool_start', { tool: toolName, args: toolArgs } as object);
			emitRunStep(appCtx.workspaceId ?? null, opts.chatId, runId, {
				type: 'tool_call',
				tool: toolName,
				args: toolArgs
			});
			break;
		}
		case 'tool_output': {
			const toolName = 'name' in item.rawItem ? String(item.rawItem.name ?? '') : 'unknown';
			let resultText = '';
			if ('output' in item.rawItem && typeof item.rawItem.output === 'string') {
				resultText =
					item.rawItem.output.length > 220
						? item.rawItem.output.slice(0, 220) + '...'
						: item.rawItem.output;
			}
			write('tool_done', { tool: toolName, result: resultText } as object);
			emitRunStep(appCtx.workspaceId ?? null, opts.chatId, runId, {
				type: 'tool_result',
				tool: toolName,
				resultSummary: resultText
			});
			break;
		}
		case 'reasoning_item_created': {
			let reasoningText = '';
			if ('rawItem' in item && item.rawItem) {
				const raw = item.rawItem as Record<string, unknown>;
				if (typeof raw.summary === 'string') {
					reasoningText = raw.summary;
				} else if (Array.isArray(raw.summary)) {
					reasoningText = raw.summary
						.filter((s: unknown) => typeof s === 'object' && s !== null && 'text' in s)
						.map((s: unknown) => (s as { text: string }).text)
						.join('\n');
				}
			}
			if (reasoningText) write('reasoning', { text: reasoningText } as object);
			break;
		}
		case 'tool_approval_requested': {
			break;
		}
		case 'message_output_created': {
			break;
		}
		default:
			break;
	}
}

function extractTextDelta(event: RunRawModelStreamEvent): string | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const data = event.data as any;
	if (!data || typeof data !== 'object') return null;
	if (data.type === 'response.output_text.delta' && typeof data.delta === 'string') {
		return data.delta;
	}
	if (data.type === 'output_text_delta' && typeof data.delta === 'string') {
		return data.delta;
	}
	if (Array.isArray(data.choices)) {
		const choice = data.choices[0];
		if (choice?.delta?.content && typeof choice.delta.content === 'string') {
			return choice.delta.content;
		}
	}
	if (typeof data.delta === 'string') {
		return data.delta;
	}
	return null;
}
