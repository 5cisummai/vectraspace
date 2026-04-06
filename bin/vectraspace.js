#!/usr/bin/env node

import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const appDir = join(projectRoot, 'app');
const composeFile = join(projectRoot, 'docker-compose.yml');
const composeOverrideFile = join(projectRoot, '.vectraspace.compose.override.yml');
const appEnvPath = join(appDir, '.env');
const appEnvExamplePath = join(appDir, '.env.example');
const rootEnvPath = join(projectRoot, '.env');
const rootEnvExamplePath = join(projectRoot, '.env.example');
const envPath = appEnvPath;
const envExamplePath = appEnvExamplePath;
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';

function style(text, color) {
	return `${color}${text}${RESET}`;
}

function banner() {
	console.log(style('VECTRASPACE CLI', `${BOLD}${MAGENTA}`));
}

function usage() {
	banner();
	console.log(`Usage: vectraspace <command>

Commands:
	onboard                 Interactive setup wizard for .env
	setup                   Validate compose and build Docker images
	init                    Run onboarding then setup
	start                   One-command start (setup + up + open browser)
	up                      Start fully containerized app stack
	stop                    Stop all services
	down                    Stop compose services
	logs                    Follow compose logs
	ps                      Show compose status
	doctor                  Validate local prerequisites
	index [directory]       Trigger a semantic reindex (root index supported)
	search <query>          Search indexed media and show scores
`);
}

function fail(message, code = 1) {
	console.error(style(message, RED));
	process.exit(code);
}

function needCmd(commandName) {
	const result = spawnSync(commandName, ['--version'], { stdio: 'ignore' });
	if (result.error || result.status !== 0) {
		fail(`Error: required command '${commandName}' not found or not working.`);
	}
}

function ensureEnvFile() {
	if (!existsSync(envPath)) {
		let source = envExamplePath;
		if (!existsSync(source)) {
			source = rootEnvExamplePath;
		}

		if (!existsSync(source)) {
			fail('Error: app/.env not found and no env.example file exists in app/ or root.');
		}

		copyFileSync(source, envPath);
		console.log(style(`Created ${appEnvPath} from ${source}.`, GREEN));
	}
}

function readEnvFile(filePath) {
	if (!existsSync(filePath)) return {};

	const content = readFileSync(filePath, 'utf8');
	const env = {};

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const equalsIndex = trimmed.indexOf('=');
		if (equalsIndex === -1) continue;
		const key = trimmed.slice(0, equalsIndex).trim();
		let value = trimmed.slice(equalsIndex + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}

	return env;
}

function runSync(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd ?? projectRoot,
		env: { ...process.env, ...(options.env ?? {}) },
		stdio: options.stdio ?? 'inherit'
	});

	if (result.error) {
		fail(result.error.message);
	}

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}

	return result;
}

function composeBaseArgs() {
	const baseArgs = ['compose', '-f', composeFile];
	if (existsSync(composeOverrideFile)) {
		baseArgs.push('-f', composeOverrideFile);
	}
	return baseArgs;
}

function compose(args, options = {}) {
	return runSync('docker', [...composeBaseArgs(), ...args], options);
}

function shellQuote(value) {
	if (value.length === 0) return '""';
	if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
	return JSON.stringify(value);
}

function stringifyEnv(env) {
	const lines = [];
	for (const [key, value] of Object.entries(env)) {
		lines.push(`${key}=${shellQuote(String(value))}`);
	}
	return `${lines.join('\n')}\n`;
}

async function promptWithDefault(rl, label, fallback) {
	const answer = (await rl.question(`${label} [${fallback}]: `)).trim();
	return answer || fallback;
}

async function promptYesNo(rl, label, fallbackYes = true) {
	const hint = fallbackYes ? 'Y/n' : 'y/N';
	const answer = (await rl.question(`${label} (${hint}): `)).trim().toLowerCase();
	if (!answer) return fallbackYes;
	return answer === 'y' || answer === 'yes';
}

async function onboard() {
	banner();
	console.log(style('Interactive onboarding', `${BOLD}${CYAN}`));

	const base = readEnvFile(envExamplePath);
	const current = readEnvFile(envPath);
	const merged = { ...base, ...current };

	const rl = readline.createInterface({ input, output });
	try {
		const mediaRoots = await promptWithDefault(rl, 'MEDIA_ROOTS (comma-separated absolute paths)', merged.MEDIA_ROOTS || '/path/to/your/media');
		const appPort = await promptWithDefault(rl, 'PORT', merged.PORT || '3000');
		const qdrantUrl = await promptWithDefault(rl, 'QDRANT_URL', merged.QDRANT_URL || 'http://127.0.0.1:6333');
		const collection = await promptWithDefault(rl, 'QDRANT_COLLECTION', merged.QDRANT_COLLECTION || 'media_semantic');
		const provider = await promptWithDefault(rl, 'EMBEDDING_PROVIDER (multimodal|ollama|openai)', merged.EMBEDDING_PROVIDER || 'multimodal');

		const nextEnv = {
			...merged,
			MEDIA_ROOTS: mediaRoots,
			PORT: appPort,
			QDRANT_URL: qdrantUrl,
			QDRANT_COLLECTION: collection,
			EMBEDDING_PROVIDER: provider
		};

		if (provider === 'multimodal') {
			nextEnv.MULTIMODAL_EMBEDDING_URL = await promptWithDefault(
				rl,
				'MULTIMODAL_EMBEDDING_URL',
				merged.MULTIMODAL_EMBEDDING_URL || 'http://127.0.0.1:8000/embed'
			);
			nextEnv.MULTIMODAL_EMBEDDING_MODEL = await promptWithDefault(
				rl,
				'MULTIMODAL_EMBEDDING_MODEL',
				merged.MULTIMODAL_EMBEDDING_MODEL || 'Qwen/Qwen3-VL-Embedding-2B'
			);
		}

		const shouldWrite = await promptYesNo(rl, 'Write these settings to .env?', true);
		if (!shouldWrite) {
			console.log(style('Onboarding canceled. No changes written.', YELLOW));
			return;
		}

		await writeFile(envPath, stringifyEnv(nextEnv), 'utf8');
		console.log(style(`Saved ${envPath}`, GREEN));
	} finally {
		rl.close();
	}
}

async function waitForEmbeddingHost(timeoutMs = 120000) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const result = spawnSync('curl', ['-fsS', 'http://127.0.0.1:8000/health'], { stdio: 'ignore' });
		if (result.status === 0) return;
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	fail('Error: embedding host did not become ready.');
}

async function waitForApp(timeoutMs = 120000, appPort = '3000') {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const result = spawnSync('curl', ['-fsS', `http://127.0.0.1:${appPort}`], { stdio: 'ignore' });
		if (result.status === 0) return;
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	fail('Error: app container did not become ready.');
}

function yamlQuote(value) {
	return JSON.stringify(value);
}

async function syncComposeOverrideFromEnv() {
	const env = readEnvFile(envPath);
	const roots = Array.from(new Set(splitMediaRoots(env.MEDIA_ROOTS)));

	if (roots.length === 0) {
		await writeFile(composeOverrideFile, 'services:\n  app: {}\n', 'utf8');
		console.log(style('[compose] No MEDIA_ROOTS configured yet; created empty override.', YELLOW));
		return;
	}

	const lines = [
		'services:',
		'  app:',
		'    volumes:'
	];

	for (const root of roots) {
		lines.push('      - type: bind');
		lines.push(`        source: ${yamlQuote(root)}`);
		lines.push(`        target: ${yamlQuote(root)}`);
		// Uploads need write access to the configured media roots.
		lines.push('        read_only: false');
	}

	await writeFile(composeOverrideFile, `${lines.join('\n')}\n`, 'utf8');
	console.log(style(`[compose] Synced media root mounts to ${composeOverrideFile}`, GREEN));
}

async function setup() {
	needCmd('docker');
	ensureEnvFile();
	await syncComposeOverrideFromEnv();

	if (!existsSync(composeFile)) {
		fail(`Error: missing docker-compose.yml at ${composeFile}`);
	}

	console.log(style('[setup] Validating compose stack...', CYAN));
	compose(['config'], { stdio: 'ignore' });

	console.log(style('[setup] Building container images...', CYAN));
	compose(['build', 'app', 'embedding-host']);

	console.log(style('[setup] Done.', GREEN));
	console.log(style(`[setup] Next: run 'vectraspace up' from ${projectRoot}`, DIM));
}

async function up() {
	needCmd('docker');
	needCmd('curl');
	ensureEnvFile();
	await syncComposeOverrideFromEnv();

	const env = readEnvFile(envPath);
	const appPort = env.PORT || '3000';

	console.log(style('[up] Starting fully containerized stack...', CYAN));
	compose(['up', '-d', '--build', 'qdrant', 'embedding-host', 'app']);

	console.log(style('[up] Waiting for embedding host on http://127.0.0.1:8000/health ...', CYAN));
	await waitForEmbeddingHost();
	console.log(style(`[up] Waiting for app on http://127.0.0.1:${appPort} ...`, CYAN));
	await waitForApp(120000, appPort);

	console.log(style(`[up] Ready: app http://127.0.0.1:${appPort}`, GREEN));
	console.log(style('[up] Use `vectraspace logs` to follow logs and `vectraspace down` to stop.', DIM));
}

function openBrowser(url) {
	let result;

	if (process.platform === 'darwin') {
		result = spawnSync('open', [url], { stdio: 'ignore' });
	} else if (process.platform === 'win32') {
		result = spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
	} else {
		result = spawnSync('xdg-open', [url], { stdio: 'ignore' });
	}

	if (result?.error || result?.status !== 0) {
		console.log(style(`[start] Browser did not open automatically. Visit ${url}`, YELLOW));
		return;
	}

	console.log(style(`[start] Opened ${url}`, GREEN));
}

async function start() {
	banner();
	console.log(style('[start] Starting Vectraspace with one command...', `${BOLD}${CYAN}`));
	await setup();
	await up();

	const env = readEnvFile(envPath);
	const appPort = env.PORT || '3000';
	const url = `http://127.0.0.1:${appPort}`;
	openBrowser(url);

	console.log(style('[start] Done. For logs: vectraspace logs | To stop: vectraspace stop', DIM));
}

function stop() {
	console.log(style('[stop] Stopping all Vectraspace services...', CYAN));
	down();
	console.log(style('[stop] Services stopped.', GREEN));
}

function down() {
	needCmd('docker');
	compose(['down']);
}

function logs() {
	needCmd('docker');
	compose(['logs', '-f', '--tail=100']);
}

function ps() {
	needCmd('docker');
	compose(['ps']);
}

function doctor() {
	needCmd('docker');
	needCmd('curl');
	ensureEnvFile();

	const env = readEnvFile(envPath);
	console.log(style('[doctor] .env loaded', GREEN));
	console.log(`${style('MEDIA_ROOTS', BOLD)} ${env.MEDIA_ROOTS ?? '<unset>'}`);
	console.log(`${style('QDRANT_URL', BOLD)} ${env.QDRANT_URL ?? 'http://127.0.0.1:6333'}`);
	console.log(`${style('MULTIMODAL_EMBEDDING_URL', BOLD)} ${env.MULTIMODAL_EMBEDDING_URL ?? 'http://127.0.0.1:8000/embed'}`);
}

function toApiBaseUrl(env) {
	const appPort = env.PORT || '3000';
	return env.VECTRASPACE_API_URL || `http://127.0.0.1:${appPort}`;
}

function splitMediaRoots(rawMediaRoots) {
	return (rawMediaRoots || '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function normalizePathForApi(pathValue) {
	return pathValue.split('\\\\').join('/');
}

function resolveApiDirectoryPath(inputPath, mediaRoots) {
	if (/^\d+(\/.*)?$/.test(inputPath)) {
		return normalizePathForApi(inputPath.replace(/\/$/, ''));
	}

	for (let index = 0; index < mediaRoots.length; index++) {
		const root = mediaRoots[index];
		const normalizedRoot = root.replace(/\/$/, '');
		if (inputPath === normalizedRoot || inputPath.startsWith(`${normalizedRoot}/`)) {
			const rest = inputPath.slice(normalizedRoot.length).replace(/^\//, '');
			return rest ? `${index}/${normalizePathForApi(rest)}` : `${index}`;
		}
	}

	return null;
}

async function requestJson(method, url, body) {
	const response = await fetch(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${response.status} ${response.statusText}: ${text}`);
	}

	return response.json();
}

async function indexDirectory(directoryArg) {
	const env = readEnvFile(envPath);
	const mediaRoots = splitMediaRoots(env.MEDIA_ROOTS);
	if (mediaRoots.length === 0) {
		fail('MEDIA_ROOTS is not configured. Run: vectraspace onboard');
	}

	let message = '[index] Triggering full semantic reindex.';
	if (directoryArg) {
		const resolved = resolveApiDirectoryPath(directoryArg, mediaRoots);
		if (!resolved) {
			fail('Directory is not under MEDIA_ROOTS. Use an absolute path under one of those roots or a root-index path (e.g. 0/movies).');
		}
		message = `[index] Triggering semantic reindex (requested path: ${resolved}).`;
	}

	banner();
	console.log(style(message, CYAN));

	const apiBase = toApiBaseUrl(env);
	const response = await requestJson('POST', `${apiBase}/api/search/reindex`);
	const summary = response.summary || {};

	console.log(style('[index] Reindex complete', GREEN));
	console.log(`  totalFiles: ${summary.totalFiles ?? 0}`);
	console.log(`  indexed: ${summary.indexed ?? 0}`);
	console.log(`  skipped: ${summary.skipped ?? 0}`);
	console.log(`  deleted: ${summary.deleted ?? 0}`);
	console.log(`  imageContentEmbeddingsUsed: ${summary.imageContentEmbeddingsUsed ?? 0}`);
}

function pad(value, length) {
	const text = String(value);
	return text.length >= length ? text : `${text}${' '.repeat(length - text.length)}`;
}

async function searchQuery(queryParts) {
	const query = queryParts.join(' ').trim();
	if (!query) {
		fail('Usage: vectraspace search <query>');
	}

	const env = readEnvFile(envPath);
	const apiBase = toApiBaseUrl(env);
	const url = new URL(`${apiBase}/api/search`);
	url.searchParams.set('q', query);
	url.searchParams.set('limit', env.VECTRASPACE_SEARCH_LIMIT || '20');

	const response = await requestJson('GET', url.toString());
	const results = Array.isArray(response.results) ? response.results : [];

	banner();
	console.log(style(`Search: ${query}`, `${BOLD}${CYAN}`));
	if (results.length === 0) {
		console.log(style('No results.', YELLOW));
		return;
	}

	console.log(style(`${pad('Score', 8)} ${pad('Delta', 8)} ${pad('Type', 10)} Path`, DIM));
	for (const row of results) {
		const score = Number(row.score || 0);
		const delta = 1 - score;
		const color = score >= 0.6 ? GREEN : score >= 0.35 ? YELLOW : RED;
		const scoreText = style(score.toFixed(4), color);
		const deltaText = style(delta.toFixed(4), MAGENTA);
		console.log(`${pad(scoreText, 17)} ${pad(deltaText, 17)} ${pad(String(row.mediaType || 'other'), 10)} ${row.path}`);
	}
}

async function initFlow() {
	await onboard();
	await setup();
}

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === '-h' || command === '--help' || command === 'help') {
	usage();
	process.exit(0);
}

switch (command) {
	case 'onboard':
		await onboard();
		break;
	case 'setup':
		await setup();
		break;
	case 'init':
		await initFlow();
		break;
	case 'start':
		await start();
		break;
	case 'up':
	case 'run':
		await up();
		break;
	case 'stop':
		stop();
		break;
	case 'down':
		down();
		break;
	case 'logs':
		logs();
		break;
	case 'ps':
	case 'status':
		ps();
		break;
	case 'doctor':
		doctor();
		break;
	case 'index':
		await indexDirectory(args[0] || '');
		break;
	case 'search':
		await searchQuery(args);
		break;
	default:
		usage();
		process.exit(1);
}