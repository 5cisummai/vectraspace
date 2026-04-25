import { env } from '$env/dynamic/private';
import {
	setDefaultOpenAIClient,
	setDefaultOpenAIKey,
	setOpenAIAPI,
	setTracingDisabled
} from '@openai/agents';
import OpenAI from 'openai';

let configured = false;

export function configureAgentProvider(): void {
	if (configured) return;
	configured = true;

	const provider = (env.LLM_PROVIDER ?? 'openai').toLowerCase();
	setTracingDisabled(true);

	if (provider === 'ollama') {
		const baseURL = env.LLM_BASE_URL
			? `${env.LLM_BASE_URL.replace(/\/+$/, '')}/v1`
			: 'http://127.0.0.1:11434/v1';
		const client = new OpenAI({
			baseURL,
			apiKey: env.LLM_API_KEY ?? 'ollama'
		});
		setDefaultOpenAIClient(client);
		setOpenAIAPI('chat_completions');
	} else {
		const baseURL = env.LLM_BASE_URL ?? undefined;
		const apiKey = env.LLM_API_KEY ?? 'no-key';
		const client = new OpenAI({ baseURL, apiKey });
		setDefaultOpenAIClient(client);
		setOpenAIAPI('chat_completions');
		if (env.LLM_API_KEY) {
			setDefaultOpenAIKey(env.LLM_API_KEY);
		}
	}
}

export function getAgentModel(): string {
	return env.LLM_MODEL ?? 'gpt-4.1';
}
