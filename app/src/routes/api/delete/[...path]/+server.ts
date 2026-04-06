import { error, json } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveSafePath } from '$lib/server/storage';
import { deleteSemanticEntryByRelativePath } from '$lib/server/semantic';
import type { RequestHandler } from './$types';

async function collectNestedFilePaths(fullPath: string, relativePath: string): Promise<string[]> {
	const stat = await fs.stat(fullPath);
	if (stat.isFile()) return [relativePath];
	if (!stat.isDirectory()) return [];

	const dirents = await fs.readdir(fullPath, { withFileTypes: true });
	const nestedPaths = await Promise.all(
		dirents.map(async (dirent) => {
			const childFullPath = path.join(fullPath, dirent.name);
			const childRelativePath = path.join(relativePath, dirent.name).split(path.sep).join('/');
			return collectNestedFilePaths(childFullPath, childRelativePath);
		})
	);

	return nestedPaths.flat();
}

export const DELETE: RequestHandler = async ({ params }) => {
	const relativePath = params.path ?? '';
	const resolved = resolveSafePath(relativePath);
	if (!resolved) throw error(400, 'Invalid path');

	if (path.resolve(resolved.fullPath) === path.resolve(resolved.root)) {
		throw error(403, 'Deleting a media root is not allowed');
	}

	let stat;
	try {
		stat = await fs.stat(resolved.fullPath);
	} catch (err) {
		if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, 'Path not found');
		}
		throw err;
	}

	if (!stat.isFile() && !stat.isDirectory()) {
		throw error(400, 'Only files and folders can be deleted');
	}

	const semanticPaths = await collectNestedFilePaths(resolved.fullPath, relativePath);

	try {
		if (stat.isDirectory()) {
			await fs.rm(resolved.fullPath, { recursive: true });
		} else {
			await fs.unlink(resolved.fullPath);
		}
	} catch (err) {
		if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error(404, 'Path not found');
		}
		throw err;
	}

	const semanticDeletes = await Promise.allSettled(
		semanticPaths.map(async (semanticPath) => {
			await deleteSemanticEntryByRelativePath(semanticPath);
			return semanticPath;
		})
	);

	for (const [index, result] of semanticDeletes.entries()) {
		if (result.status === 'rejected') {
			console.warn('Failed to delete semantic index entry:', semanticPaths[index], result.reason);
		}
	}

	return json({ success: true });
};