import { json, error } from '@sveltejs/kit';
import fs from 'node:fs/promises';
import { getMediaRoots } from '$lib/server/services/storage';
import type { RequestHandler } from './$types';

export interface DriveInfo {
	index: number;
	path: string;
	name: string;
	available: boolean;
	totalBytes?: number;
	usedBytes?: number;
	freeBytes?: number;
	usedPercent?: number;
}

export const GET: RequestHandler = async () => {
	const roots = getMediaRoots();

	const drives = await Promise.all(
		roots.map(async (root, index) => {
			try {
				const stat = await fs.statfs(root);
				const totalBytes = stat.blocks * stat.bsize;
				const freeBytes = stat.bfree * stat.bsize;
				const usedBytes = totalBytes - freeBytes;
				const usedPercent = Math.round((usedBytes / totalBytes) * 100);

				return {
					index,
					path: root,
					name: root.split('/').at(-1) ?? root,
					available: true,
					totalBytes,
					usedBytes,
					freeBytes,
					usedPercent
				} satisfies DriveInfo;
			} catch {
				return {
					index,
					path: root,
					name: root.split('/').at(-1) ?? root,
					available: false
				} satisfies DriveInfo;
			}
		})
	);

	return json(drives);
};