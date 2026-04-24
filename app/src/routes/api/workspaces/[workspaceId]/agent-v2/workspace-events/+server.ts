import { requireAgentRouteWorkspace } from '$lib/server/workspace-auth';
import { subscribe, type WorkspaceEvent } from '$lib/server/services/event-bus';
import type { RequestHandler } from './$types';

/**
 * Same as `GET /api/workspaces/.../events` but uses `requireAgentRouteWorkspace` so
 * the effective workspace (default when `ENABLE_WORKSPACES=false`) matches agent routes.
 */
export const GET: RequestHandler = async ({ locals, params, url, request }) => {
	const { workspaceId } = await requireAgentRouteWorkspace({ locals, params }, 'VIEWER');

	const typeFilter = url.searchParams
		.get('types')
		?.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	const enc = new TextEncoder();
	let cleanup: (() => void) | null = null;

	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			function send(event: WorkspaceEvent) {
				if (typeFilter && !typeFilter.includes(event.type)) return;
				try {
					controller.enqueue(
						enc.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
					);
				} catch {
					// closed
				}
			}

			const unsub = subscribe(workspaceId, send);

			const keepalive = setInterval(() => {
				try {
					controller.enqueue(enc.encode(': ping\n\n'));
				} catch {
					clearInterval(keepalive);
				}
			}, 20_000);

			cleanup = () => {
				unsub();
				clearInterval(keepalive);
			};
		},
		cancel() {
			cleanup?.();
			cleanup = null;
		}
	});

	request.signal.addEventListener('abort', () => {
		cleanup?.();
		cleanup = null;
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
			'X-Agent-Events': 'v2'
		}
	});
};
