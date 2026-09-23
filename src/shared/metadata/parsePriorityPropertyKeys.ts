/** Parses comma-separated frontmatter property names in priority order. */
export function parsePriorityPropertyKeys(value: string): string[] {
	return value
		.split(",")
		.map((key) => key.trim())
		.filter((key) => key.length > 0);
}
