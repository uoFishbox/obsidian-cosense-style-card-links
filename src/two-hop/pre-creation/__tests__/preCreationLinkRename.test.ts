import { describe, expect, it, vi } from "vitest";
import { renamePreCreationUnresolvedLinks } from "../preCreationLinkRename";

function makeFile(path = "notes/source.md") {
	return { path, extension: "md" } as any;
}

function makeApp(content: string, refs: any[]) {
	const file = makeFile();
	let current = content;
	const metadataCache = {
		getFileCache: vi.fn(() => ({ links: refs })),
		getFirstLinkpathDest: vi.fn(() => null),
	};
	const app = {
		metadataCache,
		vault: {
			process: vi.fn(async (_file: any, fn: (data: string) => string) => {
				current = fn(current);
				return current;
			}),
		},
		fileManager: {
			processFrontMatter: vi.fn(async () => undefined),
		},
	} as any;
	return { app, file, getContent: () => current };
}

function makeIndexingService(file: any) {
	return {
		awaitIdle: vi.fn(async () => undefined),
		getUniqueBacklinkSourcesForLink: vi.fn(() => [{ sourceFile: file }]),
	} as any;
}

function makeIndexUpdateBatch() {
	return {
		beginBatch: vi.fn(() => vi.fn()),
	};
}

describe("renamePreCreationUnresolvedLinks", () => {
	it("renames all matching unresolved body links while preserving alias, subpath and embed", async () => {
		const content = "[[Old#H|Alias]] and ![[Old|Cap]]";
		const first = "[[Old#H|Alias]]";
		const second = "![[Old|Cap]]";
		const secondStart = content.indexOf(second);
		const { app, file, getContent } = makeApp(content, [
			{
				link: "Old#H",
				displayText: "Alias",
				original: first,
				position: { start: { offset: 0 }, end: { offset: first.length } },
			},
			{
				link: "Old",
				displayText: "Cap",
				original: second,
				position: {
					start: { offset: secondStart },
					end: { offset: secondStart + second.length },
				},
			},
		]);
		const indexing = makeIndexingService(file);
		const indexUpdateBatch = makeIndexUpdateBatch();

		const result = await renamePreCreationUnresolvedLinks(
			app,
			indexing,
			indexUpdateBatch,
			"Old",
			"New",
		);

		expect(getContent()).toBe("[[New#H|Alias]] and ![[New|Cap]]");
		expect(result.linksUpdated).toBe(2);
		expect(result.filesUpdated).toBe(1);
		expect(app.vault.process).toHaveBeenCalledTimes(1);
	});

	it("does not create or rename files", async () => {
		const original = "[[Old]]";
		const { app, file } = makeApp(original, [
			{
				link: "Old",
				original,
				position: { start: { offset: 0 }, end: { offset: original.length } },
			},
		]);
		const indexing = makeIndexingService(file);
		const indexUpdateBatch = makeIndexUpdateBatch();
		(app.vault as any).create = vi.fn();
		(app.fileManager as any).renameFile = vi.fn();

		await renamePreCreationUnresolvedLinks(
			app,
			indexing,
			indexUpdateBatch,
			"Old",
			"New",
		);

		expect((app.vault as any).create).not.toHaveBeenCalled();
		expect((app.fileManager as any).renameFile).not.toHaveBeenCalled();
	});

	it("waits outside the index update batch", async () => {
		const original = "[[Old]]";
		const { app, file } = makeApp(original, [
			{
				link: "Old",
				original,
				position: { start: { offset: 0 }, end: { offset: original.length } },
			},
		]);
		const callOrder: string[] = [];
		const indexing = makeIndexingService(file);
		indexing.awaitIdle.mockImplementation(async () => {
			callOrder.push("idle");
		});
		const indexUpdateBatch = {
			beginBatch: vi.fn(() => {
				callOrder.push("begin");
				return () => callOrder.push("end");
			}),
		};
		app.vault.process.mockImplementation(
			async (_file: unknown, rewrite: (data: string) => string) => {
				callOrder.push("write");
				return rewrite(original);
			},
		);

		await renamePreCreationUnresolvedLinks(
			app,
			indexing,
			indexUpdateBatch,
			"Old",
			"New",
		);

		expect(callOrder).toEqual(["idle", "begin", "write", "end", "idle"]);
	});
});
