import { db } from '$lib/server/db';
import type { Prisma } from '@prisma/client';
import type { LlmMessage } from '$lib/server/services/llm';

const TTL_MS = 30 * 60 * 1000;

export interface PendingToolCallSummary {
	tool: string;
	args: Record<string, unknown>;
	resultSummary: string;
}

export interface PendingSource {
	fileId: string;
	filePath: string;
	chunk: string;
	score: number;
}

export interface PendingAgentPayload {
	messages: LlmMessage[];
	filters: {
		mediaType?: string;
		rootIndex?: number;
		fileIds?: string[];
		limit?: number;
		minScore?: number;
	};
	toolCallId: string;
	toolName: string;
	toolArgs: Record<string, unknown>;
	startIteration: number;
	toolCallsSoFar: PendingToolCallSummary[];
	sources: PendingSource[];
}

export async function createPendingConfirmation(
	userId: string,
	chatSessionId: string,
	payload: PendingAgentPayload
): Promise<string> {
	const expiresAt = new Date(Date.now() + TTL_MS);
	const row = await db.pendingToolConfirmation.create({
		data: {
			userId,
			chatSessionId,
			payload: payload as unknown as Prisma.InputJsonValue,
			expiresAt
		},
		select: { id: true }
	});

	return row.id;
}

export async function takePendingConfirmation(
	userId: string,
	pendingId: string
): Promise<{ chatSessionId: string; payload: PendingAgentPayload } | null> {
	const row = await db.pendingToolConfirmation.findFirst({
		where: {
			id: pendingId,
			userId,
			expiresAt: { gt: new Date() }
		},
		select: {
			chatSessionId: true,
			payload: true
		}
	});

	if (!row) return null;

	await db.pendingToolConfirmation.deleteMany({
		where: { id: pendingId, userId }
	});

	return {
		chatSessionId: row.chatSessionId,
		payload: row.payload as unknown as PendingAgentPayload
	};
}
