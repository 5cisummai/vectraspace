import { db } from '$lib/server/db';
import { randomUUID } from 'node:crypto';

/**
 * In-process sequence per streaming response (aligns with persisted rows).
 * Shared across the writer and persistence for a single run.
 */
export function createRunEventSequencer() {
	let seq = 0;
	return () => {
		seq += 1;
		return seq;
	};
}

export function newEventId(): string {
	return randomUUID();
}

export function persistV2SseEvent(
	runId: string,
	eventName: string,
	payload: Record<string, unknown>
): void {
	void db.agentV2StreamEvent
		.create({
			data: {
				runId,
				sequence: payload['sequence'] as number,
				eventName,
				payload: payload as object
			}
		})
		.catch((e) => {
			console.error('[agent-v2] persist stream event', e);
		});
}

export async function listV2SseEventsSince(
	runId: string,
	sinceSequence: number
): Promise<{ sequence: number; eventName: string; payload: unknown }[]> {
	return db.agentV2StreamEvent.findMany({
		where: { runId, sequence: { gt: sinceSequence } },
		orderBy: { sequence: 'asc' },
		select: { sequence: true, eventName: true, payload: true }
	});
}

