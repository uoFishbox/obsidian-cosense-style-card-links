import {
	normalizeLinkToMarkdownPath,
	toCaseInsensitiveLookupKey,
} from "../link-resolution/linkResolution";
import type { IMetadataCache } from "obsidian-integration/hostContracts";

const RESOLVED_EDGE_PREFIX = "\x01";
const UNRESOLVED_EDGE_PREFIX = "\x02";

export type EdgeKey = string;

export interface SourceEdge {
	readonly key: EdgeKey;
	readonly count: number;
}

export interface LinkIndex {
	incoming: Map<EdgeKey, Map<string, number>>;
	outgoing: Map<string, readonly SourceEdge[]>;
	/** Incoming bucket identities grouped by their case-insensitive lookup key. */
	edgeKeysByLookupKey: Map<string, Set<EdgeKey>>;
}

export interface ReadonlyLinkIndex {
	readonly incoming: ReadonlyMap<EdgeKey, ReadonlyMap<string, number>>;
	readonly outgoing: ReadonlyMap<string, readonly SourceEdge[]>;
	readonly edgeKeysByLookupKey: ReadonlyMap<string, ReadonlySet<EdgeKey>>;
}

export type EdgeIdentity =
	| { readonly type: "resolved"; readonly path: string }
	| { readonly type: "unresolved"; readonly path: string };

export interface LinkIndexMutationSink {
	markChangedEdge(key: EdgeKey): void;
}

/** Creates the canonical two-direction link index. */
export function createEmptyLinkIndex(): LinkIndex {
	return {
		incoming: new Map(),
		outgoing: new Map(),
		edgeKeysByLookupKey: new Map(),
	};
}

/** Creates the identity used for a resolved destination path. */
export function resolvedEdgeKey(path: string): EdgeKey {
	return `${RESOLVED_EDGE_PREFIX}${path}`;
}

/** Creates the case-insensitive identity used for an unresolved lookup path. */
export function unresolvedEdgeKey(rawPath: string): EdgeKey {
	const lookupPath = normalizeLinkToMarkdownPath(rawPath);
	return `${UNRESOLVED_EDGE_PREFIX}${toCaseInsensitiveLookupKey(lookupPath)}`;
}

/** Decodes an internal edge identity for query materialization and notifications. */
export function decodeEdgeKey(key: EdgeKey): EdgeIdentity | undefined {
	if (key.startsWith(RESOLVED_EDGE_PREFIX)) {
		return { type: "resolved", path: key.slice(RESOLVED_EDGE_PREFIX.length) };
	}
	if (key.startsWith(UNRESOLVED_EDGE_PREFIX)) {
		return {
			type: "unresolved",
			path: key.slice(UNRESOLVED_EDGE_PREFIX.length),
		};
	}
	return undefined;
}

/** Returns the DOM/query lookup key represented by an internal edge identity. */
export function getLookupKeyForEdge(key: EdgeKey): string | undefined {
	const edge = decodeEdgeKey(key);
	return edge ? toCaseInsensitiveLookupKey(edge.path) : undefined;
}

/** Reads a canonical host row, reusing the previous row when its edges are unchanged. */
export function readCurrentSourceRow(
	metadataCache: IMetadataCache,
	sourcePath: string,
	previousRow?: readonly SourceEdge[],
): readonly SourceEdge[] {
	const resolved = metadataCache.resolvedLinks[sourcePath];
	const unresolved = metadataCache.unresolvedLinks[sourcePath];
	let countsByKey: Map<EdgeKey, number> | undefined;
	if (unresolved) {
		for (const rawPath in unresolved) {
			if (!Object.prototype.hasOwnProperty.call(unresolved, rawPath)) continue;
			const count = unresolved[rawPath];
			if (!isPositiveCount(count)) continue;
			countsByKey ??= new Map();
			const key = unresolvedEdgeKey(rawPath);
			countsByKey.set(key, (countsByKey.get(key) ?? 0) + count);
		}
	}

	// Startup resolve events often repeat the entire graph. Compare counts before
	// allocating and sorting another edge array for each unchanged source.
	if (previousRow && matchesHostCounts(previousRow, resolved, countsByKey)) {
		return previousRow;
	}

	const row: SourceEdge[] = [];
	if (resolved) {
		for (const destinationPath in resolved) {
			if (!Object.prototype.hasOwnProperty.call(resolved, destinationPath))
				continue;
			const count = resolved[destinationPath];
			if (!isPositiveCount(count)) continue;
			row.push({ key: resolvedEdgeKey(destinationPath), count });
		}
	}
	if (countsByKey) {
		for (const [key, count] of countsByKey) {
			row.push({ key, count });
		}
	}

	row.sort(compareSourceEdges);
	return row;
}

function matchesHostCounts(
	row: readonly SourceEdge[],
	resolved: Record<string, number> | undefined,
	unresolved: ReadonlyMap<EdgeKey, number> | undefined,
): boolean {
	let edgeCount = unresolved?.size ?? 0;
	if (resolved) {
		for (const path in resolved) {
			if (!Object.prototype.hasOwnProperty.call(resolved, path)) continue;
			if (isPositiveCount(resolved[path])) edgeCount++;
		}
	}
	if (edgeCount !== row.length) return false;
	for (const edge of row) {
		const count = edge.key.startsWith(RESOLVED_EDGE_PREFIX)
			? resolved?.[edge.key.slice(RESOLVED_EDGE_PREFIX.length)]
			: unresolved?.get(edge.key);
		if (count !== edge.count) return false;
	}
	return true;
}

/** Collects the union of sources currently exposed by the host graph. */
export function collectHostSourcePaths(metadataCache: IMetadataCache): Set<string> {
	return new Set([
		...Object.keys(metadataCache.resolvedLinks),
		...Object.keys(metadataCache.unresolvedLinks),
	]);
}

/**
 * Reconciles one source row and updates its reverse edges in linear time.
 * Returns false when the host row is structurally identical.
 */
export function reconcileSourceRow(
	index: LinkIndex,
	sourcePath: string,
	nextRow: readonly SourceEdge[],
	sink: LinkIndexMutationSink,
): boolean {
	const previousRow = index.outgoing.get(sourcePath) ?? [];
	let previousIndex = 0;
	let nextIndex = 0;
	let changed = false;

	while (previousIndex < previousRow.length || nextIndex < nextRow.length) {
		const previous = previousRow[previousIndex];
		const next = nextRow[nextIndex];

		if (!next || (previous && previous.key < next.key)) {
			removeIncomingSource(index, previous.key, sourcePath);
			sink.markChangedEdge(previous.key);
			previousIndex++;
			changed = true;
			continue;
		}

		if (!previous || next.key < previous.key) {
			setIncomingSource(index, next.key, sourcePath, next.count);
			sink.markChangedEdge(next.key);
			nextIndex++;
			changed = true;
			continue;
		}

		if (previous.count !== next.count) {
			setIncomingSource(index, next.key, sourcePath, next.count);
			sink.markChangedEdge(next.key);
			changed = true;
		}
		previousIndex++;
		nextIndex++;
	}

	if (!changed) return false;
	if (nextRow.length === 0) {
		index.outgoing.delete(sourcePath);
	} else {
		index.outgoing.set(sourcePath, nextRow);
	}
	return true;
}

/** Marks every edge in a row, including presentation-only source changes. */
export function visitSourceRowKeys(
	row: readonly SourceEdge[] | undefined,
	visitor: (key: EdgeKey) => void,
): void {
	if (!row) return;
	for (const edge of row) {
		visitor(edge.key);
	}
}

/** Sets a reverse edge, registering new buckets for lookup-key queries. */
export function setIncomingSource(
	index: LinkIndex,
	key: EdgeKey,
	sourcePath: string,
	count: number,
): void {
	let sources = index.incoming.get(key);
	if (!sources) {
		sources = new Map();
		index.incoming.set(key, sources);
		const lookupKey = getLookupKeyForEdge(key);
		if (lookupKey) {
			let edgeKeys = index.edgeKeysByLookupKey.get(lookupKey);
			if (!edgeKeys) {
				edgeKeys = new Set();
				index.edgeKeysByLookupKey.set(lookupKey, edgeKeys);
			}
			edgeKeys.add(key);
		}
	}
	sources.set(sourcePath, count);
}

function removeIncomingSource(
	index: LinkIndex,
	key: EdgeKey,
	sourcePath: string,
): void {
	const sources = index.incoming.get(key);
	if (!sources) return;
	sources.delete(sourcePath);
	if (sources.size === 0) {
		index.incoming.delete(key);
		const lookupKey = getLookupKeyForEdge(key);
		if (!lookupKey) return;
		const edgeKeys = index.edgeKeysByLookupKey.get(lookupKey);
		if (!edgeKeys) return;
		edgeKeys.delete(key);
		if (edgeKeys.size === 0) index.edgeKeysByLookupKey.delete(lookupKey);
	}
}

function compareSourceEdges(left: SourceEdge, right: SourceEdge): number {
	return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

function isPositiveCount(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}
