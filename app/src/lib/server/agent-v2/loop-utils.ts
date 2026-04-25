export function summarizeToolResult(result: string): string {
	const compact = result.replace(/\s+/g, ' ').trim();
	return compact.length <= 220 ? compact : `${compact.slice(0, 220)}...`;
}
