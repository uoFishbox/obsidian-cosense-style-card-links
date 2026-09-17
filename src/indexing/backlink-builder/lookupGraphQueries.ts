import type { ReadonlyIndexState } from "../indexState";

/**
 * Finds source files for update notifications by visiting only matching buckets.
 */
export function collectSourcePathsForLookupKeys(
	snapshot: ReadonlyIndexState,
	lookupKeys: Iterable<string>,
): Set<string> {
	const result = new Set<string>();
	for (const lookupKey of new Set(lookupKeys)) {
		const edgeKeys = snapshot.edgeKeysByLookupKey.get(lookupKey);
		if (!edgeKeys) continue;
		for (const edgeKey of edgeKeys) {
			const sources = snapshot.incoming.get(edgeKey);
			if (!sources) continue;
			for (const sourcePath of sources.keys()) result.add(sourcePath);
		}
	}
	return result;
}
