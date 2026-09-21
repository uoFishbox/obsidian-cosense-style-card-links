import { beforeEach, describe, expect, test, vi } from "vitest";
import {
	extractFirstVimeoVideo,
	getVimeoVideoSource,
	resolveVimeoThumbnailUrl,
} from "../vimeoThumbnail";

const state = vi.hoisted(() => ({
	requestUrl: vi.fn(),
}));

vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof import("obsidian")>("obsidian");
	return { ...actual, requestUrl: state.requestUrl };
});

const VIDEO_ID = "76979871";

describe("Vimeo thumbnail extraction", () => {
	beforeEach(() => {
		state.requestUrl.mockReset();
	});

	test.each([
		`https://vimeo.com/${VIDEO_ID}`,
		`https://player.vimeo.com/video/${VIDEO_ID}`,
		`https://vimeo.com/channels/staffpicks/${VIDEO_ID}`,
		`https://vimeo.com/groups/animation/videos/${VIDEO_ID}`,
		`https://vimeo.com/${VIDEO_ID}/private-hash`,
	])("extracts the video identity from %s", (url) => {
		expect(getVimeoVideoSource(url)).toEqual({
			videoId: VIDEO_ID,
			videoUrl: url,
		});
	});

	test.each([
		"https://example.com/76979871",
		"https://vimeo.com/not-a-video",
		"javascript:https://vimeo.com/76979871",
	])("rejects unsupported or invalid URL %s", (url) => {
		expect(getVimeoVideoSource(url)).toBeUndefined();
	});

	test("finds a Vimeo URL in Markdown content", async () => {
		const result = await extractFirstVimeoVideo(
			`See [video](https://vimeo.com/${VIDEO_ID}).`,
		);

		expect(result?.videoId).toBe(VIDEO_ID);
	});

	test("ignores Vimeo URLs inside fenced and inline code", async () => {
		const content = [
			"```text",
			`https://vimeo.com/${VIDEO_ID}`,
			"```",
			`\`https://vimeo.com/${VIDEO_ID}\``,
		].join("\n");

		expect(await extractFirstVimeoVideo(content)).toBeUndefined();
	});

	test("resolves the thumbnail URL through Vimeo oEmbed", async () => {
		state.requestUrl.mockResolvedValue({
			status: 200,
			json: { thumbnail_url: "https://i.vimeocdn.com/video/example_640.jpg" },
		});

		await expect(
			resolveVimeoThumbnailUrl(`https://vimeo.com/${VIDEO_ID}`),
		).resolves.toBe("https://i.vimeocdn.com/video/example_640.jpg");
		expect(state.requestUrl).toHaveBeenCalledWith({
			url: `https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F${VIDEO_ID}`,
			throw: false,
		});
	});

	test("returns undefined for failed or malformed oEmbed responses", async () => {
		state.requestUrl
			.mockResolvedValueOnce({ status: 404, json: {} })
			.mockResolvedValueOnce({ status: 200, json: { thumbnail_url: 123 } });

		await expect(
			resolveVimeoThumbnailUrl(`https://vimeo.com/${VIDEO_ID}`),
		).resolves.toBeUndefined();
		await expect(
			resolveVimeoThumbnailUrl(`https://vimeo.com/${VIDEO_ID}`),
		).resolves.toBeUndefined();
	});
});
