import { Prisma } from '@prisma/client';
import { db } from '$lib/server/db';
import { randomUUID } from 'node:crypto';

/**
 * When the DB has not had migration `20260423120000_agent_v2_stream_events` applied yet,
 * every SSE event would otherwise log a full Prisma stack trace. We warn once and skip
 * further inserts until process restart (after you run `pnpm db:migrate` / `migrate deploy`).
 */
let skipV2StreamPersistence = false;
let loggedMissingV2Table = false;

function isMissingRelationOrTable(e: unknown): boolean {
	if (e instanceof Prisma.PrismaClientKnownRequestError) {
		// P2021: table does not exist; P1014: underlying DB object missing
		return e.code === 'P2021' || e.code === 'P1014';
	}
	return false;
}

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
	if (skipV2StreamPersistence) return;

	void db.agentV2StreamEvent
		.create({
			data: {
				runId,
				sequence: payload['sequence'] as number,
				eventName,
				payload: payload as object
			}
		})
		.catch((e: unknown) => {
			if (isMissingRelationOrTable(e)) {
				skipV2StreamPersistence = true;
				if (!loggedMissingV2Table) {
					loggedMissingV2Table = true;
					console.warn(
						'[agent-v2] Table `AgentV2StreamEvent` is missing — apply migrations (`cd app && pnpm db:migrate` or `prisma migrate deploy`). ' +
							'Agent streaming still works; replay persistence is disabled until then.'
					);
				}
				return;
			}
			console.error('[agent-v2] persist stream event', e);
		});
}

export async function listV2SseEventsSince(
	runId: string,
	sinceSequence: number
): Promise<{ sequence: number; eventName: string; payload: unknown }[]> {
	try {
		return await db.agentV2StreamEvent.findMany({
			where: { runId, sequence: { gt: sinceSequence } },
			orderBy: { sequence: 'asc' },
			select: { sequence: true, eventName: true, payload: true }
		});
	} catch (e: unknown) {
		if (isMissingRelationOrTable(e)) {
			if (!loggedMissingV2Table) {
				loggedMissingV2Table = true;
				console.warn(
					'[agent-v2] Table `AgentV2StreamEvent` is missing — apply migrations for replay. Returning no replay rows.'
				);
			}
			return [];
		}
		throw e;
	}
}

