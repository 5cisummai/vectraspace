// ---------------------------------------------------------------------------
// trash.ts — Hidden .trash folder utilities for undo-able deletes
//
// Files/dirs are moved to <mediaRoot>/.trash/<actionId>/<basename> instead
// of being permanently deleted. This lets us restore them on undo.
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import * as path from '$lib/server/paths';
import { getMediaRoots } from '$lib/server/services/storage';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getTrashRoot(rootPath: string): string {
	return path.join(rootPath, '.trash');
}

function getTrashEntryDir(rootPath: string, actionId: string): string {
	return path.join(getTrashRoot(rootPath), actionId);
}

// Resolve the media root that owns fullPath.
function resolveOwningRoot(fullPath: string): string | null {
	const roots = getMediaRoots();
	const resolved = path.resolve(fullPath);
	for (const root of roots) {
		const resolvedRoot = path.resolve(root);
		if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
			return resolvedRoot;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TrashMeta {
	/** Absolute path of the item inside the trash entry directory */
	trashFullPath: string;
	/** Media root absolute path (needed for restore) */
	root: string;
}

/**
 * Move a file or directory into the trash bucket for this action.
 * Returns metadata needed to restore later.
 */
export async function moveToTrash(fullPath: string, actionId: string): Promise<TrashMeta> {
	const root = resolveOwningRoot(fullPath);
	if (!root) throw new Error(`Cannot trash: path is not inside any media root — ${fullPath}`);

	const trashDir = getTrashEntryDir(root, actionId);
	await fs.mkdir(trashDir, { recursive: true });

	const basename = path.basename(fullPath);
	const trashFullPath = path.join(trashDir, basename);

	await fs.rename(fullPath, trashFullPath);
	return { trashFullPath, root };
}

/**
 * Restore an item from trash back to its original location.
 * Throws if the original location already exists (conflict) or trash entry is missing.
 */
export async function restoreFromTrash(
	actionId: string,
	restoreToFullPath: string,
	root: string
): Promise<void> {
	const trashDir = getTrashEntryDir(root, actionId);

	let entries: string[];
	try {
		entries = await fs.readdir(trashDir);
	} catch {
		throw new Error(`Trash entry not found for action ${actionId}`);
	}

	if (entries.length === 0) throw new Error(`Trash entry is empty for action ${actionId}`);

	const trashFullPath = path.join(trashDir, entries[0]);

	// Ensure restore target doesn't already exist
	try {
		await fs.access(restoreToFullPath);
		throw new Error(
			`Cannot restore: a file already exists at the original location "${restoreToFullPath}"`
		);
	} catch (err) {
		if (err instanceof Error && err.message.startsWith('Cannot restore:')) throw err;
		// ENOENT — good, path is free
	}

	// Ensure parent directory exists
	const parentDir = path.dirname(restoreToFullPath);
	await fs.mkdir(parentDir, { recursive: true });

	await fs.rename(trashFullPath, restoreToFullPath);
	await fs.rmdir(trashDir).catch(() => undefined);
}

/**
 * Permanently remove a trash entry (called when history is pruned or on redo of an undo).
 */
export async function cleanTrashEntry(actionId: string, root: string): Promise<void> {
	const trashDir = getTrashEntryDir(root, actionId);
	await fs.rm(trashDir, { recursive: true, force: true });
}
