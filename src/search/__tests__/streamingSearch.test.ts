import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { createMockTFile } from "testing/__mocks__/testHelpers";
import { runStreamingSearch, type StreamingSearchUpdate } from "../streamingSearch";
import type {
	SearchContentMatch,
	SearchItemSnapshot,
	SearchMatchedItem,
} from "../searchTypes";

function createVault(contentsByPath: ReadonlyMap<string, string>): {
	readonly vault: Vault;
	readonly cachedRead: ReturnType<typeof vi.fn>;
} {
	const cachedRead = vi.fn(
		async (file: TFile) => contentsByPath.get(file.path) ?? "",
	);
	return { vault: { cachedRead } as unknown as Vault, cachedRead };
}

function createItem(
	key: string,
	searchText: string,
	targetFilePath: string | null,
): SearchItemSnapshot {
	return { key, searchText, targetFilePath };
}

function getFinalUpdate(updates: readonly StreamingSearchUpdate[]): {
	readonly matchesByKey: ReadonlyMap<string, SearchMatchedItem>;
	readonly firstContentMatchByPath: ReadonlyMap<string, SearchContentMatch>;
} {
	const update = updates.at(-1);
	if (!update?.complete) throw new Error("Search did not publish a final update.");
	const matchesByKey = new Map<string, SearchMatchedItem>();
	const firstContentMatchByPath = new Map<string, SearchContentMatch>();
	for (const current of updates) {
		for (const match of current.addedMatches) matchesByKey.set(match.key, match);
		for (const entry of current.addedContentMatches) {
			if (!firstContentMatchByPath.has(entry.path)) {
				firstContentMatchByPath.set(entry.path, entry.match);
			}
		}
	}
	return { matchesByKey, firstContentMatchByPath };
}

describe("runStreamingSearch", () => {
	it("combines title and content terms while reading each target path once", async () => {
		const file = createMockTFile("notes/shared.md");
		const { vault, cachedRead } = createVault(
			new Map([[file.path, "prefix BETA body\nALPHA later"]]),
		);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [file],
			items: [
				createItem("title-and-body", "alpha title", file.path),
				createItem("body-and-title", "beta title", file.path),
				createItem("missing", "gamma title", null),
			],
			query: "alpha beta",
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		const result = getFinalUpdate(updates);
		expect(Array.from(result.matchesByKey.keys()).sort()).toEqual([
			"body-and-title",
			"title-and-body",
		]);
		expect(result.matchesByKey.get("title-and-body")?.contentMatched).toBe(true);
		expect(cachedRead).toHaveBeenCalledTimes(1);
	});

	it("does not read file contents for a title-only search", async () => {
		const file = createMockTFile("notes/alpha.md");
		const { vault, cachedRead } = createVault(new Map([[file.path, "alpha body"]]));
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [file],
			items: [createItem("alpha", "alpha title", file.path)],
			query: "alpha",
			scope: "title-only",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(getFinalUpdate(updates).matchesByKey.has("alpha")).toBe(true);
		expect(cachedRead).not.toHaveBeenCalled();
	});

	it("matches exact and descendant metadata tags without reading content", async () => {
		const exactFile = createMockTFile("notes/exact.md");
		const descendantFile = createMockTFile("notes/descendant.md");
		const similarFile = createMockTFile("notes/similar.md");
		const { vault, cachedRead } = createVault(
			new Map([
				[exactFile.path, "body without the query"],
				[descendantFile.path, "body without the query"],
				[similarFile.path, "contains #project as plain text"],
			]),
		);
		const tagsByPath = new Map<string, readonly string[]>([
			[exactFile.path, ["project"]],
			[descendantFile.path, ["project/active"]],
			[similarFile.path, ["projectile"]],
		]);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [exactFile, descendantFile, similarFile],
			items: [
				createItem("exact", "unrelated", exactFile.path),
				createItem("descendant", "unrelated", descendantFile.path),
				createItem("similar", "unrelated", similarFile.path),
			],
			query: "#PROJECT",
			scope: "title-and-content",
			operator: "or",
			getTagNames: (file) => tagsByPath.get(file.path) ?? [],
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"exact",
			"descendant",
		]);
		expect(cachedRead).not.toHaveBeenCalled();
	});

	it("combines included and excluded tag terms with normal text", async () => {
		const activeFile = createMockTFile("notes/active.md");
		const archivedFile = createMockTFile("notes/archived.md");
		const { vault } = createVault(new Map());
		const tagsByPath = new Map<string, readonly string[]>([
			[activeFile.path, ["project"]],
			[archivedFile.path, ["project", "archive"]],
		]);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [activeFile, archivedFile],
			items: [
				createItem("active", "alpha note", activeFile.path),
				createItem("archived", "alpha note", archivedFile.path),
			],
			query: "alpha #project -#archive",
			scope: "title-only",
			getTagNames: (file) => tagsByPath.get(file.path) ?? [],
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"active",
		]);
	});

	it("ignores WikiLink delimiters when matching title text", async () => {
		const { vault } = createVault(new Map());
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [],
			items: [createItem("wikilink-title", "text[[TEXT]]", null)],
			query: "textTEXT",
			scope: "title-only",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"wikilink-title",
		]);
	});

	it("matches a double-quoted phrase only in the same contiguous order", async () => {
		const { vault } = createVault(new Map());
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [],
			items: [
				createItem("exact-phrase", "prefix text text2 suffix", null),
				createItem("separated", "text between text2", null),
				createItem("reversed", "text2 text", null),
			],
			query: '"text text2"',
			scope: "title-only",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"exact-phrase",
		]);
	});

	it("excludes unquoted terms and quoted phrases from title matches", async () => {
		const { vault } = createVault(new Map());
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [],
			items: [
				createItem("included", "alpha allowed", null),
				createItem("excluded-term", "alpha beta", null),
				createItem("excluded-phrase", "alpha gamma delta", null),
				createItem("noncontiguous-phrase", "alpha gamma between delta", null),
			],
			query: 'alpha -beta -"gamma delta"',
			scope: "title-only",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"included",
			"noncontiguous-phrase",
		]);
	});

	it("supports exclusion-only queries and checks full-text content", async () => {
		const allowedFile = createMockTFile("notes/allowed.md");
		const blockedFile = createMockTFile("notes/blocked.md");
		const { vault, cachedRead } = createVault(
			new Map([
				[allowedFile.path, "gamma between delta"],
				[blockedFile.path, "contains gamma delta exactly"],
			]),
		);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [allowedFile, blockedFile],
			items: [
				createItem("allowed", "plain title", allowedFile.path),
				createItem("blocked", "plain title", blockedFile.path),
			],
			query: '-"gamma delta"',
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		expect(Array.from(getFinalUpdate(updates).matchesByKey.keys())).toEqual([
			"allowed",
		]);
		expect(cachedRead).toHaveBeenCalledTimes(2);
	});

	it("ignores WikiLink delimiters while preserving raw content offsets", async () => {
		const file = createMockTFile("notes/wikilink.md");
		const { vault } = createVault(
			new Map([[file.path, "prefix text[[TEXT]] and [[tail]]END"]]),
		);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [file],
			items: [createItem("wikilink-content", "unrelated", file.path)],
			query: "textTEXT tailEND",
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		const result = getFinalUpdate(updates);
		expect(Array.from(result.matchesByKey.keys())).toEqual(["wikilink-content"]);
		expect(result.firstContentMatchByPath.get(file.path)).toEqual({
			offset: 7,
			length: 10,
		});
	});

	it("publishes the first content match offset without scanning for line numbers", async () => {
		const file = createMockTFile("notes/alpha.md");
		const plainContent = `${"line\n".repeat(1_000_000)}find alpha here`;
		const wrappedContent = new String(plainContent);
		const charCodeAt = vi.fn(String.prototype.charCodeAt.bind(wrappedContent));
		Object.defineProperty(wrappedContent, "charCodeAt", { value: charCodeAt });
		const { vault } = createVault(
			new Map([[file.path, wrappedContent as unknown as string]]),
		);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [file],
			items: [createItem("alpha", "unrelated", file.path)],
			query: "alpha",
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		const position = getFinalUpdate(updates).firstContentMatchByPath.get(file.path);
		expect(position).toEqual({
			offset: plainContent.length - "alpha here".length,
			length: 5,
		});
		expect(charCodeAt).not.toHaveBeenCalled();
	});

	it("treats regular expression metacharacters as case-insensitive literal text", async () => {
		const exactFile = createMockTFile("notes/exact.md");
		const falsePositiveFile = createMockTFile("notes/false-positive.md");
		const { vault } = createVault(
			new Map([
				[exactFile.path, "Literal A.B then [TAG] and FOO+BAR"],
				[falsePositiveFile.path, "Literal AXB then T and FOOBAR"],
			]),
		);
		const updates: StreamingSearchUpdate[] = [];

		await runStreamingSearch({
			vault,
			files: [exactFile, falsePositiveFile],
			items: [
				createItem("exact", "unrelated", exactFile.path),
				createItem("false-positive", "unrelated", falsePositiveFile.path),
			],
			query: "a.b [tag] foo+bar",
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
		});

		const result = getFinalUpdate(updates);
		expect(Array.from(result.matchesByKey.keys())).toEqual(["exact"]);
		expect(result.firstContentMatchByPath.get(exactFile.path)).toEqual({
			offset: 8,
			length: 3,
		});
		expect(result.firstContentMatchByPath.has(falsePositiveFile.path)).toBe(false);
	});

	it("publishes matches only by appending in dataset order", async () => {
		const firstFile = createMockTFile("notes/content-first.md");
		const { vault } = createVault(new Map([[firstFile.path, "alpha in body"]]));
		const updates: StreamingSearchUpdate[] = [];
		let clock = 0;

		await runStreamingSearch({
			vault,
			files: [firstFile],
			items: [
				createItem("content-first", "unrelated", firstFile.path),
				...Array.from({ length: 9 }, (_unused, index) =>
					createItem(`missing-${index}`, "unrelated", null),
				),
				createItem("title-second", "alpha title", null),
			],
			query: "alpha",
			scope: "title-and-content",
			isCancelled: () => false,
			onUpdate: (update) => updates.push(update),
			yieldToMainThread: async () => {},
			now: () => (clock += 20),
		});

		const publishedKeys = updates.map((update) =>
			update.addedMatches.map((match) => match.key),
		);
		expect(publishedKeys).toEqual([["content-first"], ["title-second"]]);
	});

	it("yields after the time budget and stops before publishing stale work", async () => {
		const { vault } = createVault(new Map());
		const items = Array.from({ length: 30 }, (_unused, index) =>
			createItem(`item-${index}`, "alpha", null),
		);
		let cancelled = false;
		const yieldToMainThread = vi.fn(async () => {
			cancelled = true;
		});
		const onUpdate = vi.fn();
		let clock = 0;

		await runStreamingSearch({
			vault,
			files: [],
			items,
			query: "alpha",
			scope: "title-only",
			isCancelled: () => cancelled,
			onUpdate,
			yieldToMainThread,
			now: () => (clock += 6),
		});

		expect(yieldToMainThread).toHaveBeenCalledTimes(1);
		expect(onUpdate.mock.calls.some(([update]) => update.complete)).toBe(false);
	});
});
