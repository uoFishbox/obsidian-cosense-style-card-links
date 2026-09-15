import type { TFile, Vault } from "obsidian";
import { yieldToMainThreadIdleAware } from "indexing/timeSlicing";
import { getFileContent } from "card-preview/pipeline/previewContent";
import {
	buildWikiLinkInsensitiveLiteralSource,
	getSearchQueryTerms,
} from "./searchQueryTerms";
import type {
	SearchItemSnapshot,
	SearchContentMatch,
	SearchMatchedItem,
	SearchMatchScope,
} from "./searchTypes";

const YIELD_CHECK_INTERVAL = 10;
const YIELD_BUDGET_MS = 5;
const YIELD_MAX_DELAY_MS = 100;
interface ContentTermMatches {
	readonly included: readonly boolean[];
	readonly excluded: readonly boolean[];
	readonly firstMatch: SearchContentMatch | null;
}

export interface StreamingSearchContentMatchUpdate {
	readonly path: string;
	readonly match: SearchContentMatch;
}

/** Append-only delta published at a cooperative yield boundary or completion. */
export interface StreamingSearchUpdate {
	readonly complete: boolean;
	readonly addedMatches: readonly SearchMatchedItem[];
	readonly addedContentMatches: readonly StreamingSearchContentMatchUpdate[];
}

export interface RunStreamingSearchOptions {
	readonly vault: Vault;
	readonly items: readonly SearchItemSnapshot[];
	readonly files: readonly TFile[];
	readonly query: string;
	readonly scope: SearchMatchScope;
	readonly operator?: "and" | "or";
	/** Resolves normalized Obsidian tag names for a target file on demand. */
	readonly getTagNames?: (file: TFile) => readonly string[];
	readonly isCancelled: () => boolean;
	readonly onUpdate: (update: StreamingSearchUpdate) => void;
	readonly yieldToMainThread?: () => Promise<void>;
	readonly now?: () => number;
}

/**
 * Searches unique files on demand and cooperatively yields using the same
 * short-budget strategy as Obsidian's core search.
 */
export async function runStreamingSearch(
	options: RunStreamingSearchOptions,
): Promise<void> {
	const terms = getSearchQueryTerms(options.query);
	const matchesIncludedTerms = (matches: readonly boolean[]): boolean =>
		options.operator === "or"
			? matches.length === 0 || matches.some(Boolean)
			: matches.every(Boolean);
	const includedMatchers = terms.included.map(createCaseInsensitiveWikiLinkMatcher);
	const excludedMatchers = terms.excluded.map(createCaseInsensitiveWikiLinkMatcher);
	const hasTagTerms = terms.includedTags.length > 0 || terms.excludedTags.length > 0;
	const contentMatchesByPath = new Map<string, ContentTermMatches>();
	const tagNamesByPath = new Map<string, readonly string[]>();
	const fileByPath = new Map(options.files.map((file) => [file.path, file]));
	const now = options.now ?? (() => performance.now());
	const yieldToMainThread =
		options.yieldToMainThread ??
		(() => yieldToMainThreadIdleAware({ maxDelayMs: YIELD_MAX_DELAY_MS }));
	let lastYieldTime = now();
	let processedCount = 0;
	let pendingMatches: SearchMatchedItem[] = [];
	let pendingContentMatches: StreamingSearchContentMatchUpdate[] = [];

	const publish = (complete: boolean): void => {
		if (options.isCancelled()) return;
		if (
			!complete &&
			pendingMatches.length === 0 &&
			pendingContentMatches.length === 0
		)
			return;

		const addedMatches = pendingMatches;
		const addedContentMatches = pendingContentMatches;
		pendingMatches = [];
		pendingContentMatches = [];
		options.onUpdate({
			complete,
			addedMatches,
			addedContentMatches,
		});
	};

	const checkpoint = async (): Promise<boolean> => {
		processedCount += 1;
		if (options.isCancelled()) return false;
		if (processedCount % YIELD_CHECK_INTERVAL !== 0) return true;

		const currentTime = now();
		if (currentTime - lastYieldTime <= YIELD_BUDGET_MS) return true;

		publish(false);
		await yieldToMainThread();
		lastYieldTime = now();
		return !options.isCancelled();
	};

	for (const item of options.items) {
		if (options.isCancelled()) return;

		const tagNames = hasTagTerms
			? getTagNamesForPath(
					item.targetFilePath,
					fileByPath,
					tagNamesByPath,
					options.getTagNames,
				)
			: [];
		const tagIncludedMatches = terms.includedTags.map((tag) =>
			matchesTag(tagNames, tag),
		);
		const hasExcludedTagMatch = terms.excludedTags.some((tag) =>
			matchesTag(tagNames, tag),
		);
		const titleIncludedMatches = includedMatchers.map((matcher) =>
			matcher.test(item.searchText),
		);
		const titleHasExcludedMatch = excludedMatchers.some((matcher) =>
			matcher.test(item.searchText),
		);
		if (titleHasExcludedMatch || hasExcludedTagMatch) {
			if (!(await checkpoint())) return;
			continue;
		}

		const includedMatches = [...titleIncludedMatches, ...tagIncludedMatches];
		const hasRequiredTagMismatch =
			options.operator !== "or" && tagIncludedMatches.some((matched) => !matched);
		const hasOnlyUnmatchedOrTags =
			options.operator === "or" &&
			includedMatchers.length === 0 &&
			tagIncludedMatches.length > 0 &&
			!tagIncludedMatches.some(Boolean);
		if (hasRequiredTagMismatch || hasOnlyUnmatchedOrTags) {
			if (!(await checkpoint())) return;
			continue;
		}

		const titleMatchesIncludedTerms = matchesIncludedTerms(includedMatches);
		const requiresContentCheck =
			options.scope === "title-and-content" &&
			item.targetFilePath !== null &&
			(!titleMatchesIncludedTerms || excludedMatchers.length > 0);
		if (!requiresContentCheck && titleMatchesIncludedTerms) {
			pendingMatches.push({
				key: item.key,
				contentMatched: false,
			});
		} else if (requiresContentCheck && item.targetFilePath) {
			const path = item.targetFilePath;
			let contentTermMatches = contentMatchesByPath.get(path);
			if (!contentTermMatches) {
				const file = fileByPath.get(path);
				if (file) {
					const content = await readContent(file, options.vault);
					if (options.isCancelled()) return;
					contentTermMatches = matchContentTerms(
						content,
						includedMatchers,
						excludedMatchers,
					);
					contentMatchesByPath.set(path, contentTermMatches);
					if (contentTermMatches.firstMatch) {
						pendingContentMatches.push({
							path,
							match: contentTermMatches.firstMatch,
						});
					}
				}
			}

			if (
				contentTermMatches &&
				!contentTermMatches.excluded.some(Boolean) &&
				matchesIncludedTerms([
					...titleIncludedMatches.map(
						(matched, index) =>
							matched || contentTermMatches.included[index],
					),
					...tagIncludedMatches,
				])
			) {
				pendingMatches.push({
					key: item.key,
					contentMatched: hasRequiredContentMatch(
						titleIncludedMatches,
						contentTermMatches.included,
					),
				});
			}
		}

		if (!(await checkpoint())) return;
	}

	if (!options.isCancelled()) publish(true);
}

function getTagNamesForPath(
	path: string | null,
	fileByPath: ReadonlyMap<string, TFile>,
	tagNamesByPath: Map<string, readonly string[]>,
	getTagNames: ((file: TFile) => readonly string[]) | undefined,
): readonly string[] {
	if (!path || !getTagNames) return [];
	const cached = tagNamesByPath.get(path);
	if (cached) return cached;

	const file = fileByPath.get(path);
	const tagNames = file ? getTagNames(file) : [];
	tagNamesByPath.set(path, tagNames);
	return tagNames;
}

function matchesTag(tagNames: readonly string[], targetTag: string): boolean {
	const descendantPrefix = `${targetTag}/`;
	return tagNames.some(
		(tag) => tag === targetTag || tag.startsWith(descendantPrefix),
	);
}

async function readContent(file: TFile, vault: Vault): Promise<string> {
	try {
		return await getFileContent(file, vault);
	} catch {
		return "";
	}
}

function createCaseInsensitiveWikiLinkMatcher(term: string): RegExp {
	return new RegExp(buildWikiLinkInsensitiveLiteralSource(term), "i");
}

function matchContentTerms(
	content: string,
	includedMatchers: readonly RegExp[],
	excludedMatchers: readonly RegExp[],
): ContentTermMatches {
	const included: boolean[] = [];
	let firstMatch: SearchContentMatch | null = null;

	for (const matcher of includedMatchers) {
		const match = matcher.exec(content);
		included.push(match !== null);
		if (!match || (firstMatch && firstMatch.offset <= match.index)) continue;
		firstMatch = {
			offset: match.index,
			length: match[0].length,
		};
	}

	return {
		included,
		excluded: excludedMatchers.map((matcher) => matcher.test(content)),
		firstMatch,
	};
}

function hasRequiredContentMatch(
	titleMatches: readonly boolean[],
	contentMatches: readonly boolean[],
): boolean {
	for (let index = 0; index < titleMatches.length; index += 1) {
		if (!titleMatches[index] && contentMatches[index]) return true;
	}
	return false;
}
