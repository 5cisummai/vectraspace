export type MessageStatus = 'pending' | 'success' | 'failed';

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

/** One row in the transcript (synced with server when ids are known). */
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	status: MessageStatus;
	authorUserId?: string | null;
	authorDisplayName?: string | null;
	authorUsername?: string | null;
	sources?: Source[];
	toolCalls?: ToolCallSummary[];
	iterations?: number;
	model?: string;
	/** Shown when the user changed text after a prior send */
	editedFrom?: string | null;
	/** Local error / retry */
	errorMessage?: string;
	/**
	 * Assistant only: text variants from repeated regenerations (oldest → newest).
	 * The last entry matches the latest successful server response when synced.
	 */
	assistantVariants?: string[];
	/** Index into assistantVariants for undo/redo navigation */
	variantIndex?: number;
}

export interface ChatResponsePayload {
	chat: {
		id: string;
		title: string;
		userId?: string;
		createdBy?: {
			userId: string;
			username: string;
			displayName: string;
		};
	};
	messages: Array<{
		id: string;
		role: 'user' | 'assistant';
		content: string;
		authorUserId?: string;
		authorDisplayName?: string;
		authorUsername?: string;
		sources?: Source[];
		toolCalls?: ToolCallSummary[];
		model?: string;
		iterations?: number;
		createdAt: string;
	}>;
}

export interface PendingToolConfirmation {
	pendingId: string;
	tool: string;
	args: Record<string, unknown>;
	chatId?: string;
	requestedByUserId?: string;
	requestedByDisplayName?: string | null;
}
