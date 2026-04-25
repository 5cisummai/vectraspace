import { randomUUID } from 'node:crypto';

export interface AgentLogEntry {
	traceId: string;
	timestamp: string;
	level: 'debug' | 'info' | 'warn' | 'error';
	event: string;
	data?: Record<string, unknown>;
}

export class AgentLogger {
	readonly traceId: string;
	private startMs: number;

	constructor(traceId?: string) {
		this.traceId = traceId ?? randomUUID();
		this.startMs = Date.now();
	}

	private emit(level: AgentLogEntry['level'], event: string, data?: Record<string, unknown>): void {
		const entry: AgentLogEntry = {
			traceId: this.traceId,
			timestamp: new Date().toISOString(),
			level,
			event,
			...(data ? { data } : {})
		};

		if (level === 'error') {
			console.error(JSON.stringify(entry));
		} else if (level === 'warn') {
			console.warn(JSON.stringify(entry));
		} else {
			console.log(JSON.stringify(entry));
		}
	}

	debug(event: string, data?: Record<string, unknown>): void {
		this.emit('debug', event, data);
	}

	info(event: string, data?: Record<string, unknown>): void {
		this.emit('info', event, data);
	}

	warn(event: string, data?: Record<string, unknown>): void {
		this.emit('warn', event, data);
	}

	error(event: string, data?: Record<string, unknown>): void {
		this.emit('error', event, data);
	}

	elapsed(): number {
		return Date.now() - this.startMs;
	}
}
