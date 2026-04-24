import { error } from '@sveltejs/kit';
import { listV2SseEventsSince } from '$lib/server/agent-v2/run-events';
import { getAgentRunForWorkspace } from '$lib/server/agent-runs';
import { requireAgentRouteWorkspace } from '$lib/server/workspace-auth';
import type { RequestHandler } from './$types';

function sseEvent(name: string, data: unknown): string {
	return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Reconnect / replay: stream persisted V2 event rows (same `event` names as the live run).
 * Query: `?sinceSequence=<n>` (exclusive) — use last received `sequence` from a v2 `data` object.
 */
export const GET: RequestHandler = async (event) => {
	const { workspaceId } = await requireAgentRouteWorkspace(event, 'VIEWER');
	const runId = event.params.runId;
	if (!runId) throw error(400, 'runId is required');

	const run = await getAgentRunForWorkspace(workspaceId, runId);
	if (!run) throw error(404, 'Run not found');
	// Defensive: ensure run is owned/visible; workspace-scoped run already

	const since = Math.max(0, Number(event.url.searchParams.get('sinceSequence') ?? 0) || 0);
	const rows = await listV2SseEventsSince(runId, since);

	const enc = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const r of rows) {
				try {
					controller.enqueue(enc.encode(sseEvent(r.eventName, r.payload)));
				} catch {
					break;
				}
			}
			controller.close();
		}
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'X-Agent-Transport': 'v2-replay'
		}
	});
};
