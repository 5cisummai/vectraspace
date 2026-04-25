import type { SearchResult } from '$lib/server/semantic';
import type { Source } from '../types';

export class SourceTracker {
	private map = new Map<string, Source>();

	seed(sources: Source[]): void {
		for (const s of sources) {
			this.map.set(s.fileId, s);
		}
	}

	addResult(r: SearchResult): void {
		if (!this.map.has(r.id)) {
			this.map.set(r.id, {
				fileId: r.id,
				filePath: r.path,
				chunk: r.name || r.path,
				score: r.score
			});
		}
	}

	toMap(): Map<string, Source> {
		return new Map(this.map);
	}

	toArray(): Source[] {
		return Array.from(this.map.values());
	}
}
