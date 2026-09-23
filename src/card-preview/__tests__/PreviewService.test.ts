import { afterEach, describe, test, expect, vi, beforeEach, type Mock } from "vitest";
import { MarkdownRenderer, requestUrl } from "obsidian";
import {
	createPreviewService,
	type DisposablePreviewService,
	type PreviewResolver,
} from "../pipeline/createPreviewService";
import { generateVideoPreview } from "../renderers/videoPreviewRenderer";
import { generateCanvasPreview } from "../renderers/canvasPreviewRenderer";
import { createCardPreviewSharedCache } from "card-preview/ui/cardPreviewSharedCache";
import { createPreviewRenderSettings } from "card-preview/pipeline/previewRenderSettings";
import { DEFAULT_SETTINGS, type PluginSettings } from "settings/model";
import type { IVault, IMetadataCache } from "obsidian-integration/hostContracts";
import {
	createMockTFileAsPlainObject,
	createMockVault,
} from "testing/__mocks__/testHelpers";

vi.mock("../renderers/videoPreviewRenderer", () => ({
	clearVideoPreviewQueue: vi.fn(),
	generateVideoPreview: vi.fn(),
}));

vi.mock("../renderers/canvasPreviewRenderer", () => ({
	generateCanvasPreview: vi.fn(),
}));

vi.mock("obsidian", () => ({
	renderMath: vi.fn(),
	finishRenderMath: vi.fn(),
	Component: class {
		load() {}
		unload() {}
	},
	TFile: class {},
	MarkdownRenderer: { render: vi.fn().mockResolvedValue(undefined) },
	requestUrl: vi.fn(),
}));

function createMockMetadataCache(): IMetadataCache {
	return {
		getFileCache: vi.fn(),
		getFirstLinkpathDest: vi.fn(),
	} as any;
}

describe("PreviewService.getPreview", () => {
	let vault: IVault;
	let metadataCache: IMetadataCache;
	let previewService: DisposablePreviewService;
	let settings: PluginSettings;
	const previewSharedCache = createCardPreviewSharedCache();

	function createService(resolvePreview?: PreviewResolver): DisposablePreviewService {
		return createPreviewService(
			{
				vault,
				metadataCache,
				app: { workspace: {} } as any,
				getSettings: () => settings,
			},
			resolvePreview,
		);
	}

	beforeEach(() => {
		vault = createMockVault();
		metadataCache = createMockMetadataCache();
		settings = DEFAULT_SETTINGS;
		previewService = createService();
		previewSharedCache.clear();
		vi.clearAllMocks();
	});

	afterEach(() => {
		previewService.dispose();
	});

	describe("image file processing", () => {
		test.each(["png", "jpg", "jpeg", "webp"])(
			"%s files return an image preview",
			async (ext) => {
				const file = createMockTFileAsPlainObject(`image.${ext}`, ext);
				const result = await previewService.getPreview(file);
				expect(result.type).toBe("image");
				expect(result.content).toBe(`app://local/${file.path}`);
			},
		);
	});

	describe("video file processing", () => {
		beforeEach(() => {
			(generateVideoPreview as Mock).mockResolvedValue(undefined);
		});

		test.each(["mp4", "webm"])(
			"%s files attempt video preview generation",
			async (ext) => {
				const file = createMockTFileAsPlainObject(`video.${ext}`, ext);
				const result = await previewService.getPreview(file);
				expect(result.type).toBe("empty");
			},
		);
	});

	describe("Canvas file processing", () => {
		beforeEach(() => {
			(generateCanvasPreview as Mock).mockResolvedValue(undefined);
		});

		test("attempts Canvas preview generation for Canvas files", async () => {
			const file = createMockTFileAsPlainObject("canvas.canvas", "canvas");
			const result = await previewService.getPreview(file);
			expect(result.type).toBe("empty");
		});
	});

	describe("text retrieval from frontmatter", () => {
		test("uses the first non-empty text property in comma-separated priority order", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeyForPreview:
					" missing, empty, description, summary ",
			};
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: {
					empty: "   ",
					description: " First preview ",
					summary: "Second preview",
				},
			});

			const result = await previewService.getPreview(file);

			expect(result).toEqual({ type: "text", content: "First preview" });
		});
	});

	describe("image retrieval from frontmatter", () => {
		beforeEach(() => {
			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeysForImagePreview: "image",
			};
		});

		test("returns image preview when frontmatter has an image URL", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const imageUrl = "https://example.com/image.jpg";
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: { image: imageUrl },
			});
			(vault.cachedRead as Mock).mockResolvedValue("");

			const result = await previewService.getPreview(file);
			expect(result.type).toBe("image");
			expect(result.content).toBe(imageUrl);
		});

		test("resolves and returns image preview when frontmatter has an internal link image", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const imageFile = createMockTFileAsPlainObject("image.png", "png");
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: { image: "[[image.png]]" },
			});
			(metadataCache.getFirstLinkpathDest as Mock).mockReturnValue(imageFile);
			(vault.cachedRead as Mock).mockResolvedValue("");

			const result = await previewService.getPreview(file);
			expect(result.type).toBe("image");
			expect(result.content).toBe(`app://local/${imageFile.path}`);
		});

		test("uses configured image properties in comma-separated priority order", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const coverUrl = "https://example.com/cover.jpg";
			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeysForImagePreview: " cover, thumbnail ",
			};
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: {
					image: "https://example.com/default.jpg",
					cover: coverUrl,
					thumbnail: "https://example.com/thumbnail.jpg",
				},
			});
			(vault.cachedRead as Mock).mockResolvedValue("");

			const result = await previewService.getPreview(file);

			expect(result).toEqual({ type: "image", content: coverUrl });
		});

		test("falls back to the next configured property with a valid image", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const imageFile = createMockTFileAsPlainObject("thumbnail.png", "png");
			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeysForImagePreview: "cover, thumbnail",
			};
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: {
					cover: "not-an-image",
					thumbnail: "[[thumbnail.png]]",
				},
			});
			(metadataCache.getFirstLinkpathDest as Mock).mockReturnValue(imageFile);
			(vault.cachedRead as Mock).mockResolvedValue("");

			const result = await previewService.getPreview(file);

			expect(result).toEqual({
				type: "image",
				content: `app://local/${imageFile.path}`,
			});
		});

		test("invalidates the preview cache when configured image properties change", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const coverUrl = "https://example.com/cover.jpg";
			const thumbnailUrl = "https://example.com/thumbnail.jpg";
			(metadataCache.getFileCache as Mock).mockReturnValue({
				frontmatter: { cover: coverUrl, thumbnail: thumbnailUrl },
			});

			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeysForImagePreview: "cover",
			};
			const cover = await previewService.getPreview(file);
			settings = {
				...DEFAULT_SETTINGS,
				priorityFrontmatterKeysForImagePreview: "thumbnail",
			};
			const thumbnail = await previewService.getPreview(file);

			expect(cover).toEqual({ type: "image", content: coverUrl });
			expect(thumbnail).toEqual({ type: "image", content: thumbnailUrl });
		});
	});

	describe("image retrieval from Markdown embeds", () => {
		test("returns image preview without MarkdownRenderer for extensionless http(s) Markdown image URLs", async () => {
			const file = createMockTFileAsPlainObject("note.md");
			const imageUrl = "https://example.com/api/image?id=123";
			(metadataCache.getFileCache as Mock).mockReturnValue({});
			(metadataCache.getFirstLinkpathDest as Mock).mockReturnValue(undefined);
			(vault.cachedRead as Mock).mockResolvedValue(`![](${imageUrl})`);

			const result = await previewService.getPreview(file);
			expect(result).toEqual({ type: "image", content: imageUrl });
			expect(MarkdownRenderer.render).not.toHaveBeenCalled();
		});
	});

	describe("YouTube thumbnail retrieval", () => {
		test("uses a YouTube URL in note content as an image preview", async () => {
			const file = createMockTFileAsPlainObject("video-note.md");
			const videoId = "dQw4w9WgXcQ";
			(metadataCache.getFileCache as Mock).mockReturnValue({});
			(vault.cachedRead as Mock).mockResolvedValue(
				`Watch https://www.youtube.com/watch?v=${videoId}`,
			);

			const result = await previewService.getPreview(file);

			expect(result).toEqual({
				type: "image",
				content: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
				fallbackContent: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
			});
		});
	});

	describe("Vimeo thumbnail retrieval", () => {
		test("uses Vimeo oEmbed for a Vimeo URL in note content", async () => {
			const file = createMockTFileAsPlainObject("vimeo-note.md");
			const videoUrl = "https://vimeo.com/76979871";
			const thumbnailUrl =
				"https://i.vimeocdn.com/video/example-thumbnail_640.jpg";
			(metadataCache.getFileCache as Mock).mockReturnValue({});
			(vault.cachedRead as Mock).mockResolvedValue(`Watch ${videoUrl}`);
			(requestUrl as unknown as Mock).mockResolvedValue({
				status: 200,
				json: { thumbnail_url: thumbnailUrl },
			});

			const result = await previewService.getPreview(file);

			expect(result).toEqual({ type: "image", content: thumbnailUrl });
			expect(requestUrl).toHaveBeenCalledWith({
				url: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`,
				throw: false,
			});
		});
	});

	test("shares cachedRead during a single preview generation", async () => {
		const file = createMockTFileAsPlainObject("note.md");
		(vault.cachedRead as Mock).mockResolvedValue("plain text only");
		(metadataCache.getFileCache as Mock).mockReturnValue({});

		const result = await previewService.getPreview(file);
		expect(vault.cachedRead).toHaveBeenCalledTimes(1);
		expect(result.type).toBe("text");
	});

	test("shares raw content between preview generation and search context", async () => {
		const file = createMockTFileAsPlainObject("note.md");
		(vault.cachedRead as Mock).mockResolvedValue("before alpha after");
		(metadataCache.getFileCache as Mock).mockReturnValue({});

		const result = await previewService.getPreview(file);

		expect(result.type).toBe("text");

		await expect(
			previewSharedCache.applySharedSearchContextToTextPreview({
				previewContent: "<p>fallback preview</p>",
				cacheKey: "preview-id:shared-raw",
				targetFile: file,
				normalizedQuery: "alpha",
				settings: createPreviewRenderSettings(DEFAULT_SETTINGS),
				vault: vault as any,
				getRawContent: previewService.getRawContent,
			}),
		).resolves.toContain("alpha");

		expect(vault.cachedRead).toHaveBeenCalledTimes(1);
	});

	test("shares in-flight raw content reads and invalidates them by mtime", async () => {
		const file = createMockTFileAsPlainObject("shared-note.md");
		let resolveContent!: (content: string) => void;
		(vault.cachedRead as Mock).mockReturnValueOnce(
			new Promise<string>((resolve) => {
				resolveContent = resolve;
			}),
		);

		const first = previewService.getRawContent(file);
		const second = previewService.getRawContent(file);
		resolveContent("first revision");

		await expect(Promise.all([first, second])).resolves.toEqual([
			"first revision",
			"first revision",
		]);
		expect(vault.cachedRead).toHaveBeenCalledTimes(1);

		file.stat.mtime += 1;
		(vault.cachedRead as Mock).mockResolvedValueOnce("second revision");
		await expect(previewService.getRawContent(file)).resolves.toBe(
			"second revision",
		);
		expect(vault.cachedRead).toHaveBeenCalledTimes(2);
	});

	test("first embed extraction is memoized within one generation", async () => {
		const file = createMockTFileAsPlainObject("note.md");
		(vault.cachedRead as Mock).mockResolvedValue(
			"```md\n![[ignored.png]]\n```\n![[shared.png]]",
		);
		(metadataCache.getFileCache as Mock).mockReturnValue({});

		const observedTargets: Array<string | undefined> = [];
		const resolvePreview: PreviewResolver = async (_file, context) => {
			const first = await context.getFirstEmbeddedMedia();
			const second = await context.getFirstEmbeddedMedia();
			observedTargets.push(first?.target, second?.target);
			return { type: "text", content: second?.target ?? "" };
		};
		const service = createService(resolvePreview);

		const result = await service.getPreview(file);
		expect(vault.cachedRead).toHaveBeenCalledTimes(1);
		expect(observedTargets).toEqual(["shared.png", "shared.png"]);
		expect(result).toEqual({ type: "text", content: "shared.png" });
	});

	test("preview generation cache is separated by settings affecting generation", async () => {
		const resolvePreview = vi.fn<PreviewResolver>(async (_file, context) => ({
			type: "text" as const,
			content: String(context.settings.cardWidthPx),
		}));
		const service = createService(resolvePreview);
		const file = createMockTFileAsPlainObject("note.md");

		settings = { ...DEFAULT_SETTINGS, cardWidthPx: 100 };
		const first = await service.getPreview(file);
		settings = { ...DEFAULT_SETTINGS, cardWidthPx: 200 };
		const second = await service.getPreview(file);
		const third = await service.getPreview(file);

		expect(first).toEqual({ type: "text", content: "100" });
		expect(second).toEqual({ type: "text", content: "200" });
		expect(third).toEqual({ type: "text", content: "200" });
		expect(resolvePreview).toHaveBeenCalledTimes(2);
	});

	test("uses requested card dimensions for generation and cache identity", async () => {
		const resolvePreview = vi.fn<PreviewResolver>(async (_file, context) => ({
			type: "text" as const,
			content: `${context.settings.cardWidthPx}:${context.settings.cardHeightRatio}`,
		}));
		const service = createService(resolvePreview);
		const file = createMockTFileAsPlainObject("dimensioned-note.md");
		const firstSettings = createPreviewRenderSettings({
			...DEFAULT_SETTINGS,
			cardWidthPx: 170,
			cardHeightRatio: 1.2,
		});
		const secondSettings = createPreviewRenderSettings({
			...DEFAULT_SETTINGS,
			cardWidthPx: 200,
			cardHeightRatio: 1.2,
		});

		const first = await service.getPreview(file, undefined, {
			renderSettings: firstSettings,
		});
		const firstCached = await service.getPreview(file, undefined, {
			renderSettings: firstSettings,
		});
		const second = await service.getPreview(file, undefined, {
			renderSettings: secondSettings,
		});

		expect(first).toEqual({ type: "text", content: "170:1.2" });
		expect(firstCached).toBe(first);
		expect(second).toEqual({ type: "text", content: "200:1.2" });
		expect(resolvePreview).toHaveBeenCalledTimes(2);
	});

	test("Blob URL image previews are evicted from cache by byteSize and count-limit-equivalent size", async () => {
		const revokeObjectURL = vi.fn();
		const originalRevokeObjectURL = URL.revokeObjectURL;
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: revokeObjectURL,
		});

		const resolvePreview = vi.fn<PreviewResolver>(async (file) => ({
			type: "image" as const,
			content: `blob:${file.path}`,
			byteSize: 1,
		}));
		const service = createService(resolvePreview);

		try {
			for (let index = 0; index < 81; index++) {
				const file = createMockTFileAsPlainObject(`video-${index}.mp4`, "mp4");
				await service.getPreview(file);
			}

			expect(revokeObjectURL).toHaveBeenCalledWith("blob:video-0.mp4");
			expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		} finally {
			service.dispose();
			Object.defineProperty(URL, "revokeObjectURL", {
				configurable: true,
				value: originalRevokeObjectURL,
			});
		}
	});
});
