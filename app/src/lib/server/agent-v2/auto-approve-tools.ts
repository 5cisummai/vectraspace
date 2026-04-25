const AUTO_APPROVABLE = new Set(['delete_file', 'move', 'copy_file', 'mkdir']);

const MAX_NAMES = 32;
const MAX_LEN = 64;

export function normalizeAutoApproveToolNames(raw: unknown): string[] | undefined {
	if (raw === undefined || raw === null) return undefined;
	if (!Array.isArray(raw)) return undefined;
	const out: string[] = [];
	const seen = new Set<string>();
	for (const x of raw) {
		if (typeof x !== 'string') continue;
		let n = x.trim().slice(0, MAX_LEN);
		if (n === 'move_file' || n === 'move_files') n = 'move';
		if (!n || !AUTO_APPROVABLE.has(n) || seen.has(n)) continue;
		seen.add(n);
		out.push(n);
		if (out.length >= MAX_NAMES) break;
	}
	return out.length ? out : undefined;
}

export function shouldAutoApproveTool(
	autoApproveToolNames: string[] | undefined,
	toolName: string
): boolean {
	if (!autoApproveToolNames?.length) return false;
	if (autoApproveToolNames.includes(toolName)) return true;
	if (toolName === 'move') {
		return (
			autoApproveToolNames.includes('move_file') && autoApproveToolNames.includes('move_files')
		);
	}
	return false;
}
