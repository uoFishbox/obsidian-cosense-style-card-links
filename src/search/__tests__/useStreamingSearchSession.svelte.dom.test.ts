import { render, screen, waitFor } from "@testing-library/svelte";
import type { App, CachedMetadata, TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { createMockTFile } from "testing/__mocks__/testHelpers";
import UseStreamingSearchSessionHarness from "./UseStreamingSearchSessionHarness.svelte";
import type { SearchItemSnapshot } from "../searchTypes";

vi.mock("../fileContentVaultEventHub", () => ({
	getFileContentVaultEventHub: () => ({
		subscribe: () => () => {},
	}),
}));

function createApp(
	cachedRead: (file: TFile) => Promise<string>,
	metadataByPath: ReadonlyMap<string, CachedMetadata> = new Map(),
): App {
	return {
		vault: { cachedRead } as unknown as Vault,
		metadataCache: {
			getFileCache: (file: TFile) => metadataByPath.get(file.path) ?? null,
		},
	} as App;
}

function createDataset(file: TFile): SearchItemSnapshot[] {
	return [
		{ key: "alpha", searchText: "alpha title", targetFilePath: file.path },
		{ key: "beta", searchText: "beta title", targetFilePath: file.path },
	];
}

describe("useStreamingSearchSession", () => {
	it("commits a title-only result without reading content", async () => {
		const file = createMockTFile("notes/shared.md");
		const cachedRead = vi.fn(async () => "alpha body");

		render(UseStreamingSearchSessionHarness, {
			props: {
				app: createApp(cachedRead),
				query: "alpha",
				enabled: true,
				files: [file],
				dataset: createDataset(file),
				matchScope: "title-only",
			},
		});

		await waitFor(() =>
			expect(screen.getByTestId("phase")).toHaveTextContent("ready"),
		);
		expect(screen.getByTestId("visible-keys")).toHaveTextContent("alpha");
		expect(cachedRead).not.toHaveBeenCalled();
	});

	it("searches both inline and Properties tags from Obsidian metadata", async () => {
		const inlineFile = createMockTFile("notes/inline.md");
		const propertiesFile = createMockTFile("notes/properties.md");
		const unrelatedFile = createMockTFile("notes/unrelated.md");
		const cachedRead = vi.fn(async () => "");
		const metadataByPath = new Map<string, CachedMetadata>();
		metadataByPath.set(inlineFile.path, {
			tags: [
				{
					tag: "#Project",
					position: {
						start: { line: 0, col: 0, offset: 0 },
						end: { line: 0, col: 8, offset: 8 },
					},
				},
			],
		});
		metadataByPath.set(propertiesFile.path, {
			frontmatter: { tags: ["project"] },
		} as unknown as CachedMetadata);
		const files = [inlineFile, propertiesFile, unrelatedFile];

		render(UseStreamingSearchSessionHarness, {
			props: {
				app: createApp(cachedRead, metadataByPath),
				query: "#project",
				enabled: true,
				files,
				dataset: files.map((file) => ({
					key: file.basename,
					searchText: "unrelated title",
					targetFilePath: file.path,
				})),
				matchScope: "title-only",
			},
		});

		await waitFor(() =>
			expect(screen.getByTestId("phase")).toHaveTextContent("ready"),
		);
		expect(screen.getByTestId("visible-keys")).toHaveTextContent(
			"inline,properties",
		);
		expect(cachedRead).not.toHaveBeenCalled();
	});

	it("exposes the position produced by an on-demand content match", async () => {
		const file = createMockTFile("notes/shared.md");

		render(UseStreamingSearchSessionHarness, {
			props: {
				app: createApp(async () => "line one\ncontains beta"),
				query: "beta",
				enabled: true,
				files: [file],
				dataset: [
					{ key: "beta", searchText: "unrelated", targetFilePath: file.path },
				],
				matchScope: "title-and-content",
			},
		});

		await waitFor(() =>
			expect(screen.getByTestId("phase")).toHaveTextContent("ready"),
		);
		expect(screen.getByTestId("visible-keys")).toHaveTextContent("beta");
		expect(screen.getByTestId("first-position").textContent).toContain(
			'"start":{"line":1,"col":9,"offset":18}',
		);
	});

	it("does not adopt an older query after a newer query completes", async () => {
		const file = createMockTFile("notes/shared.md");
		let resolveAlpha!: (content: string) => void;
		const alphaRead = new Promise<string>((resolve) => {
			resolveAlpha = resolve;
		});
		const cachedRead = vi
			.fn<(file: TFile) => Promise<string>>()
			.mockImplementationOnce(() => alphaRead)
			.mockResolvedValue("beta body");
		const dataset = [
			{ key: "result", searchText: "unrelated", targetFilePath: file.path },
		];
		const app = createApp(cachedRead);
		const view = render(UseStreamingSearchSessionHarness, {
			props: {
				app,
				query: "alpha",
				enabled: true,
				files: [file],
				dataset,
			},
		});

		await waitFor(() => expect(cachedRead).toHaveBeenCalled());
		await view.rerender({
			app,
			query: "beta",
			enabled: true,
			files: [file],
			dataset,
		});
		await waitFor(() =>
			expect(screen.getByTestId("visible-query")).toHaveTextContent("beta"),
		);

		resolveAlpha("alpha body");
		await Promise.resolve();
		expect(screen.getByTestId("visible-query")).toHaveTextContent("beta");
	});
});
