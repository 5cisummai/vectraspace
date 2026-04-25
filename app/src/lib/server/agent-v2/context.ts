import type { AgentLogger } from './logger';
import type { AskFilters, AgentEvent, ToolCallSummary } from './types';
import { SourceTracker } from './memory/sources';

export interface AgentAppContext {
	userId: string;
	chatId: string;
	isAdmin: boolean;
	workspaceId?: string;
	filters: AskFilters;
	autoApproveToolNames?: string[];
	sourceTracker: SourceTracker;
	toolCalls: ToolCallSummary[];
	logger: AgentLogger;
	onEvent?: (event: AgentEvent) => void;
}

export function createAppContext(opts: {
	userId: string;
	chatId: string;
	isAdmin: boolean;
	workspaceId?: string;
	filters: AskFilters;
	autoApproveToolNames?: string[];
	logger: AgentLogger;
	onEvent?: (event: AgentEvent) => void;
}): AgentAppContext {
	return {
		userId: opts.userId,
		chatId: opts.chatId,
		isAdmin: opts.isAdmin,
		workspaceId: opts.workspaceId,
		filters: opts.filters,
		autoApproveToolNames: opts.autoApproveToolNames,
		sourceTracker: new SourceTracker(),
		toolCalls: [],
		logger: opts.logger,
		onEvent: opts.onEvent
	};
}
