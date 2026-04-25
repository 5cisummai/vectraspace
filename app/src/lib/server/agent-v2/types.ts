import type { MediaType } from '$lib/server/services/storage';
import type { WorkspaceRole } from '@prisma/client';

export interface AskFilters {
	mediaType?: MediaType;
	rootIndex?: number;
	fileIds?: string[];
	limit?: number;
	minScore?: number;
}

export interface Source {
	fileId: string;
	filePath: string;
	chunk: string;
	score: number;
}

export interface ToolCallSummary {
	tool: string;
	args: Record<string, unknown>;
	resultSummary: string;
}

export interface AgentRequest {
	question: string;
	history?: StoredChatMessage[];
	filters?: AskFilters;
	autoApproveToolNames?: string[];
}

export interface ConversationMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface StoredChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	authorUserId?: string | null;
	authorDisplayName?: string | null;
	authorUsername?: string | null;
	sources?: unknown;
	toolCalls?: unknown;
	model?: string | null;
	iterations?: number | null;
	createdAt: string;
}

export type AgentOutcome = AgentComplete | AgentPendingConfirmation;

export interface AgentComplete {
	kind: 'complete';
	sources: Map<string, Source>;
	toolCalls: ToolCallSummary[];
	iterations: number;
	finalText: string | null;
}

export interface AgentPendingConfirmation {
	kind: 'pending_confirmation';
	pendingId: string;
	tool: string;
	args: Record<string, unknown>;
	toolCallsSoFar: ToolCallSummary[];
	sources: Map<string, Source>;
	iterations: number;
}

export type AgentEvent =
	| { type: 'tool_start'; tool: string; args?: Record<string, unknown> }
	| { type: 'tool_done'; tool: string; resultSummary?: string }
	| { type: 'tool_thinking'; tool: string; thinking: string }
	| { type: 'token'; text: string }
	| { type: 'meta'; payload: AgentMetaPayload }
	| {
			type: 'confirmation_required';
			pendingId: string;
			tool: string;
			args: Record<string, unknown>;
			chatId: string;
	  }
	| { type: 'message_saved'; role: 'user' | 'assistant'; id: string }
	| { type: 'error'; message: string; code?: string }
	| { type: 'done' };

export interface AgentMetaPayload {
	chatId: string;
	sources: Source[];
	filters: Record<string, unknown>;
	model: string;
	toolCalls: ToolCallSummary[];
	iterations: number;
	awaitingConfirmation?: boolean;
}

export interface AgentRunConfig {
	userId: string;
	userDisplayName: string;
	userUsername: string;
	isAdmin: boolean;
	workspaceRole: WorkspaceRole;
	chatId?: string;
	workspaceId: string;
	regenerate?: boolean;
	maxHistoryMessages?: number;
	autoApproveToolNames?: string[];
}

export interface ConfirmRunConfig {
	userId: string;
	isAdmin: boolean;
	workspaceRole: WorkspaceRole;
	pendingId: string;
	approved: boolean;
	chatId?: string;
	workspaceId: string;
	autoApproveToolNames?: string[];
}

export const DEFAULT_LIMIT = 8;
export const DEFAULT_MIN_SCORE = 0.5;
export const MAX_AGENT_ITERATIONS = 50;
