export class AgentError extends Error {
	readonly code: string;
	readonly cause?: unknown;

	constructor(code: string, message: string, options?: { cause?: unknown }) {
		super(message);
		this.name = 'AgentError';
		this.code = code;
		this.cause = options?.cause;
	}

	toJSON(): { code: string; message: string } {
		return { code: this.code, message: this.message };
	}
}

export class ToolError extends AgentError {
	readonly toolName: string;
	readonly toolArgs: Record<string, unknown>;

	constructor(
		toolName: string,
		toolArgs: Record<string, unknown>,
		message: string,
		options?: { cause?: unknown }
	) {
		super('TOOL_ERROR', `Tool "${toolName}" failed: ${message}`, options);
		this.name = 'ToolError';
		this.toolName = toolName;
		this.toolArgs = toolArgs;
	}
}

export class ModelError extends AgentError {
	readonly statusCode?: number;

	constructor(message: string, options?: { cause?: unknown; statusCode?: number }) {
		super('MODEL_ERROR', message, options);
		this.name = 'ModelError';
		this.statusCode = options?.statusCode;
	}
}

export class SystemError extends AgentError {
	constructor(message: string, options?: { cause?: unknown }) {
		super('SYSTEM_ERROR', message, options);
		this.name = 'SystemError';
	}
}

export class ValidationError extends AgentError {
	constructor(message: string) {
		super('VALIDATION_ERROR', message);
		this.name = 'ValidationError';
	}
}

export function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	return 'Unknown error';
}
