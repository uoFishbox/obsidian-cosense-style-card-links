import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { PreviewRequestOptions } from "card-preview/types";
import { DEFAULT_SETTINGS } from "settings/model";
import { createPreviewRenderSettings } from "card-preview/pipeline/previewRenderSettings";
import type { CardCollectionState } from "cards/CardCollectionState.svelte";
import type { AppContext, LinkContext } from "cards/context/linkContext";
import type { CardItem } from "cards/CardItem";
import type { CardRenderModel } from "cards/rendering/cardRenderModel";
import {
	flushFrames,
	installAnimationFrameMock,
	installIntersectionObserverMock,
	installResizeObserverMock,
	resetRecords,
	setElementRect,
	setNumericProperty,
	teardownAnimationFrameMock,
	teardownIntersectionObserverMock,
	teardownResizeObserverMock,
	triggerResize,
} from "testing/helpers/DOMObserverMock";
import FlatCardGridPreviewHarness from "./FlatCardGridPreviewHarness.svelte";
import {
	createPreviewRuntime,
	type PreviewRuntime,
} from "card-preview/runtime/previewRuntime";

const previewRuntimes = new Set<PreviewRuntime>();

beforeEach(() => {
	resetRecords();
	installResizeObserverMock();
	installIntersectionObserverMock();
	installAnimationFrameMock();
});

afterEach(() => {
	cleanup();
	for (const runtime of previewRuntimes) runtime.dispose();
	previewRuntimes.clear();
	teardownResizeObserverMock();
	teardownIntersectionObserverMock();
	teardownAnimationFrameMock();
});

function createModel(file: TFile): CardRenderModel {
	const item = { type: "file", data: file } as CardItem;
	return {
		item,
		targetFile: file,
		title: file.basename,
		ariaLabel: file.basename,
		className: null,
		extension: "md",
		interactionDescriptor: null,
		searchQuery: "",
		previewRequest: {
			renderKey: `preview:${file.path}`,
			previewCacheRevision: "0:0",
			file,
			searchQuery: "",
			previewOverride: null,
			settings: createPreviewRenderSettings(DEFAULT_SETTINGS),
		},
	};
}

function findCardByTitle(root: ShadowRoot, title: string): HTMLElement | null {
	return (
		Array.from(root.querySelectorAll<HTMLElement>(".ccl-box")).find(
			(element) =>
				element.querySelector(".ccl-box-title")?.textContent?.trim() === title,
		) ?? null
	);
}

async function renderSinglePreview(
	model: CardRenderModel,
	getPreview: LinkContext["getPreview"],
	sectionId: string,
	previewSelector = "img",
) {
	const file = model.targetFile;
	if (!file) throw new TypeError("Preview test model requires a target file");
	const linkContext = {
		getPreview,
		sourceFile: file,
		fileToLinktext: () => "card",
		getMetadata: () => null,
	} as unknown as LinkContext;
	const applicationStore = {
		settings: DEFAULT_SETTINGS,
		previewState: { getRenderVersion: () => "0:0" },
	} as unknown as CardCollectionState;
	const app = { vault: {} } as App;
	const previewRuntime = createPreviewRuntime({ app, getPreview });
	previewRuntimes.add(previewRuntime);
	const appContext = {
		app,
		applicationStore,
		linkContext,
		bookmarks: {
			filePaths: new Set(),
			orderedFilePaths: [],
			isBookmarked: () => false,
		},
		previewRuntime,
	} as AppContext;
	const rendered = render(FlatCardGridPreviewHarness, {
		props: {
			models: [model],
			linkContext,
			appContext,
			applicationStore,
			sectionId,
		},
	});
	const scrollRoot = rendered.container.querySelector<HTMLElement>(
		'[data-testid="scroll-root"]',
	);
	const gridRoot = rendered.container.querySelector<HTMLElement>(".ccl-virtual-grid");
	if (!scrollRoot || !gridRoot) {
		throw new TypeError("Virtual grid test surface was not rendered");
	}
	setNumericProperty(scrollRoot, "clientHeight", 240);
	setNumericProperty(scrollRoot, "scrollTop", 0);
	setElementRect(scrollRoot, { top: 0, width: 330, height: 240 });
	gridRoot.style.setProperty("--ccl-box-size", "100px");
	gridRoot.style.setProperty("--ccl-box-height", "120px");
	gridRoot.style.setProperty("--ccl-box-gap", "10px");
	gridRoot.style.setProperty("--ccl-box-cols-max", "3");
	setElementRect(gridRoot, { top: 0, width: 330, height: 500 });
	triggerResize(gridRoot, 330, 500);
	triggerResize(scrollRoot, 330, 240);
	for (let index = 0; index < 8; index += 1) {
		await flushFrames();
		await Promise.resolve();
	}
	const shadowRoot = gridRoot.shadowRoot;
	if (!shadowRoot) throw new TypeError("Missing virtual grid shadow root");
	await waitFor(() => expect(shadowRoot.querySelector(previewSelector)).toBeTruthy());

	return { rendered, shadowRoot, linkContext, appContext, applicationStore };
}

describe("FlatCardGrid preview surface", () => {
	it("commits preview DOM through the virtual surface", async () => {
		const file = {
			path: "notes/flat.md",
			basename: "flat",
			extension: "md",
			parent: { path: "notes" },
			stat: { mtime: 1 },
		} as TFile;
		const getPreview = vi.fn(
			async (
				_file: TFile,
				_signal?: AbortSignal,
				_options?: PreviewRequestOptions,
			) => ({
				type: "image" as const,
				content: "https://example.com/flat.png",
			}),
		);
		const linkContext = {
			getPreview,
			sourceFile: file,
			fileToLinktext: () => "flat",
			getMetadata: () => null,
		} as unknown as LinkContext;
		const customCss = ".ccl-box { color: rebeccapurple; }";
		const applicationStore = {
			settings: { ...DEFAULT_SETTINGS, experimentalShadowDomCss: customCss },
			previewState: { getRenderVersion: () => "0:0" },
		} as unknown as CardCollectionState;
		const app = { vault: {} } as App;
		const previewRuntime = createPreviewRuntime({ app, getPreview });
		previewRuntimes.add(previewRuntime);
		const appContext = {
			app,
			applicationStore,
			linkContext,
			bookmarks: {
				filePaths: new Set(),
				orderedFilePaths: [],
				isBookmarked: () => false,
			},
			previewRuntime,
		} as AppContext;
		const { container } = render(FlatCardGridPreviewHarness, {
			props: {
				models: [createModel(file)],
				linkContext,
				appContext,
				applicationStore,
			},
		});
		const scrollRoot = container.querySelector<HTMLElement>(
			'[data-testid="scroll-root"]',
		);
		const gridRoot = container.querySelector<HTMLElement>(".ccl-virtual-grid");
		if (!scrollRoot || !gridRoot) {
			throw new TypeError("Virtual grid test surface was not rendered");
		}
		expect(
			gridRoot.shadowRoot?.querySelector(
				"style[data-ccl-card-render-shadow-custom-style]",
			)?.textContent,
		).toBe(customCss);
		setNumericProperty(scrollRoot, "clientHeight", 240);
		setNumericProperty(scrollRoot, "scrollTop", 0);
		setElementRect(scrollRoot, { top: 0, width: 330, height: 240 });
		gridRoot.style.setProperty("--ccl-box-size", "100px");
		gridRoot.style.setProperty("--ccl-box-height", "120px");
		gridRoot.style.setProperty("--ccl-box-gap", "10px");
		gridRoot.style.setProperty("--ccl-box-cols-max", "3");
		setElementRect(gridRoot, { top: 0, width: 330, height: 500 });
		triggerResize(gridRoot, 330, 500);
		triggerResize(scrollRoot, 330, 240);
		for (let index = 0; index < 6; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}
		const host =
			gridRoot.shadowRoot?.querySelector<HTMLElement>(".ccl-box-preview");
		expect(host).not.toBeNull();
		await waitFor(() => expect(getPreview).toHaveBeenCalled());
		expect(getPreview).toHaveBeenCalledWith(file, expect.anything(), {
			cacheRevision: "0:0",
			renderSettings: expect.objectContaining({
				cardWidthPx: 159,
				cardHeightRatio: 175 / 159,
			}),
		});
		for (let index = 0; index < 4; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		expect(host?.classList.contains("ccl-box-preview--image")).toBe(true);
		expect(host?.querySelector("img")).not.toBeNull();
	});

	it("keeps preview DOM stable when a uniquely identified item moves indexes", async () => {
		const files = ["duplicate-a.md", "duplicate-b.md"].map(
			(path, index) =>
				({
					path,
					basename: path.replace(/\.md$/, ""),
					extension: "md",
					parent: { path: "" },
					stat: { mtime: index + 1 },
				}) as TFile,
		);
		const models = files.map(createModel);
		const getPreview = vi.fn(async (file: TFile) => ({
			type: "image" as const,
			content: `https://example.com/${file.basename}.png`,
		}));
		const linkContext = {
			getPreview,
			sourceFile: files[0],
			fileToLinktext: () => "card",
			getMetadata: () => null,
		} as unknown as LinkContext;
		const applicationStore = {
			settings: DEFAULT_SETTINGS,
			previewState: { getRenderVersion: () => "0:0" },
		} as unknown as CardCollectionState;
		const app = { vault: {} } as App;
		const previewRuntime = createPreviewRuntime({ app, getPreview });
		previewRuntimes.add(previewRuntime);
		const appContext = {
			app,
			applicationStore,
			linkContext,
			bookmarks: {
				filePaths: new Set(),
				orderedFilePaths: [],
				isBookmarked: () => false,
			},
			previewRuntime,
		} as AppContext;
		const getItemId = (model: CardRenderModel) => model.targetFile!.path;
		const rendered = render(FlatCardGridPreviewHarness, {
			props: {
				models,
				linkContext,
				appContext,
				applicationStore,
				getItemId,
			},
		});
		const scrollRoot = rendered.container.querySelector<HTMLElement>(
			'[data-testid="scroll-root"]',
		);
		const gridRoot =
			rendered.container.querySelector<HTMLElement>(".ccl-virtual-grid");
		if (!scrollRoot || !gridRoot) {
			throw new TypeError("Virtual grid test surface was not rendered");
		}
		setNumericProperty(scrollRoot, "clientHeight", 240);
		setNumericProperty(scrollRoot, "scrollTop", 0);
		setElementRect(scrollRoot, { top: 0, width: 330, height: 240 });
		gridRoot.style.setProperty("--ccl-box-size", "100px");
		gridRoot.style.setProperty("--ccl-box-height", "120px");
		gridRoot.style.setProperty("--ccl-box-gap", "10px");
		gridRoot.style.setProperty("--ccl-box-cols-max", "3");
		setElementRect(gridRoot, { top: 0, width: 330, height: 500 });
		triggerResize(gridRoot, 330, 500);
		triggerResize(scrollRoot, 330, 240);
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		const shadowRoot = gridRoot.shadowRoot;
		if (!shadowRoot) throw new TypeError("Missing virtual grid shadow root");
		await waitFor(() => {
			const image = findCardByTitle(shadowRoot, "duplicate-b")?.querySelector(
				"img",
			);
			expect(image).toBeTruthy();
		});
		const imageBefore = findCardByTitle(shadowRoot, "duplicate-b")?.querySelector(
			"img",
		);
		if (!imageBefore) throw new TypeError("Missing duplicate-b preview image");
		const loadsBefore = getPreview.mock.calls.filter(
			([file]) => file.path === "duplicate-b.md",
		).length;

		await rendered.rerender({
			models: [models[1]!],
			linkContext,
			appContext,
			applicationStore,
			getItemId,
		});
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		const imageAfter = findCardByTitle(shadowRoot, "duplicate-b")?.querySelector(
			"img",
		);
		expect(imageAfter).toBe(imageBefore);
		expect(
			getPreview.mock.calls.filter(([file]) => file.path === "duplicate-b.md"),
		).toHaveLength(loadsBefore);
	});

	it("keeps preview DOM stable when the section scope changes", async () => {
		const file = {
			path: "stable-preview.canvas",
			basename: "stable-preview",
			extension: "canvas",
			parent: { path: "" },
			stat: { mtime: 1 },
		} as TFile;
		const model = createModel(file);
		const renderDom = vi.fn(async (container: HTMLElement) => {
			const canvas = container.ownerDocument.createElement("div");
			canvas.dataset.canvasPreview = "true";
			container.replaceChildren(canvas);
		});
		const getPreview = vi.fn(async () => ({
			type: "dom" as const,
			attachment: "resource-bound" as const,
			render: renderDom,
		}));
		const { rendered, shadowRoot, linkContext, appContext, applicationStore } =
			await renderSinglePreview(
				model,
				getPreview,
				"search:foo",
				"[data-canvas-preview]",
			);
		const previewBefore = shadowRoot.querySelector("[data-canvas-preview]");

		await rendered.rerender({
			models: [model],
			linkContext,
			appContext,
			applicationStore,
			sectionId: "search:bar",
		});
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		expect(shadowRoot.querySelector("[data-canvas-preview]")).toBe(previewBefore);
		expect(getPreview).toHaveBeenCalledTimes(1);
		expect(renderDom).toHaveBeenCalledTimes(1);
	});

	it("rerenders a stable item when its preview render key changes", async () => {
		const file = {
			path: "search-preview.md",
			basename: "search-preview",
			extension: "md",
			parent: { path: "" },
			stat: { mtime: 1 },
		} as TFile;
		const initialModel = createModel(file);
		const nextModel = {
			...initialModel,
			previewRequest: {
				...initialModel.previewRequest!,
				renderKey: "preview:search-preview.md:bar",
				searchQuery: "bar",
			},
		};
		const getPreview = vi.fn(async () => ({
			type: "image" as const,
			content: "https://example.com/search-preview.png",
		}));
		const { rendered, linkContext, appContext, applicationStore } =
			await renderSinglePreview(initialModel, getPreview, "search:foo");
		expect(getPreview).toHaveBeenCalledTimes(1);

		await rendered.rerender({
			models: [nextModel],
			linkContext,
			appContext,
			applicationStore,
			sectionId: "search:bar",
		});
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		await waitFor(() => expect(getPreview).toHaveBeenCalledTimes(2));
	});

	it("replaces a rebound card preview without showing stale content", async () => {
		const files = ["preview-a.md", "preview-b.md"].map(
			(path, index) =>
				({
					path,
					basename: path.replace(/\.md$/, ""),
					extension: "md",
					parent: { path: "" },
					stat: { mtime: index + 1 },
				}) as TFile,
		);
		const models = files.map(createModel);
		const getPreview = vi.fn(async (file: TFile) => ({
			type: "image" as const,
			content: `https://example.com/${file.basename}.png`,
		}));
		const linkContext = {
			getPreview,
			sourceFile: files[0],
			fileToLinktext: () => "card",
			getMetadata: () => null,
		} as unknown as LinkContext;
		const applicationStore = {
			settings: DEFAULT_SETTINGS,
			previewState: { getRenderVersion: () => "0:0" },
		} as unknown as CardCollectionState;
		const app = { vault: {} } as App;
		const previewRuntime = createPreviewRuntime({ app, getPreview });
		previewRuntimes.add(previewRuntime);
		const appContext = {
			app,
			applicationStore,
			linkContext,
			bookmarks: {
				filePaths: new Set(),
				orderedFilePaths: [],
				isBookmarked: () => false,
			},
			previewRuntime,
		} as AppContext;
		const rendered = render(FlatCardGridPreviewHarness, {
			props: {
				models: [models[0]!],
				linkContext,
				appContext,
				applicationStore,
			},
		});
		const scrollRoot = rendered.container.querySelector<HTMLElement>(
			'[data-testid="scroll-root"]',
		);
		const gridRoot =
			rendered.container.querySelector<HTMLElement>(".ccl-virtual-grid");
		if (!scrollRoot || !gridRoot) {
			throw new TypeError("Virtual grid test surface was not rendered");
		}
		setNumericProperty(scrollRoot, "clientHeight", 240);
		setNumericProperty(scrollRoot, "scrollTop", 0);
		setElementRect(scrollRoot, { top: 0, width: 330, height: 240 });
		gridRoot.style.setProperty("--ccl-box-size", "100px");
		gridRoot.style.setProperty("--ccl-box-height", "120px");
		gridRoot.style.setProperty("--ccl-box-gap", "10px");
		gridRoot.style.setProperty("--ccl-box-cols-max", "3");
		setElementRect(gridRoot, { top: 0, width: 330, height: 500 });
		triggerResize(gridRoot, 330, 500);
		triggerResize(scrollRoot, 330, 240);
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}
		const shadowRoot = gridRoot.shadowRoot;
		if (!shadowRoot) throw new TypeError("Missing virtual grid shadow root");
		await waitFor(() => {
			const image = shadowRoot.querySelector<HTMLImageElement>("img");
			expect(image?.src).toContain("preview-a.png");
		});

		await rendered.rerender({
			models: [models[1]!],
			linkContext,
			appContext,
			applicationStore,
		});
		for (let index = 0; index < 8; index += 1) {
			await flushFrames();
			await Promise.resolve();
		}

		await waitFor(() => {
			const images = shadowRoot.querySelectorAll<HTMLImageElement>("img");
			expect(images).toHaveLength(1);
			expect(images[0]?.src).toContain("preview-b.png");
			expect(images[0]?.src).not.toContain("preview-a.png");
		});
	});
});
