import { describe, expect, test, vi } from "vitest";
import {
	createYouTubeThumbnailSource,
	extractFirstYouTubeThumbnail,
	getYouTubeVideoId,
} from "../youtubeThumbnail";

const VIDEO_ID = "dQw4w9WgXcQ";

describe("YouTube thumbnail extraction", () => {
	test.each([
		`https://www.youtube.com/watch?v=${VIDEO_ID}`,
		`https://m.youtube.com/watch?v=${VIDEO_ID}&t=10`,
		`https://youtu.be/${VIDEO_ID}?si=example`,
		`https://youtube.com/shorts/${VIDEO_ID}`,
		`https://youtube.com/embed/${VIDEO_ID}`,
	])("extracts the video ID from %s", (url) => {
		expect(getYouTubeVideoId(url)).toBe(VIDEO_ID);
	});

	test.each([
		"https://example.com/watch?v=dQw4w9WgXcQ",
		"https://youtube.com/watch?v=too-short",
		"javascript:https://youtube.com/watch?v=dQw4w9WgXcQ",
	])("rejects unsupported or invalid URL %s", (url) => {
		expect(getYouTubeVideoId(url)).toBeUndefined();
	});

	test("builds max-resolution and high-quality fallback URLs", () => {
		expect(
			createYouTubeThumbnailSource(`https://www.youtube.com/watch?v=${VIDEO_ID}`),
		).toEqual({
			videoId: VIDEO_ID,
			maxResolutionUrl: `https://img.youtube.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
			fallbackUrl: `https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`,
		});
	});

	test("finds a URL in plain text and Markdown links", async () => {
		const result = await extractFirstYouTubeThumbnail(
			`See [video](https://www.youtube.com/watch?v=${VIDEO_ID}).`,
		);

		expect(result?.videoId).toBe(VIDEO_ID);
	});

	test("ignores URLs inside fenced and inline code", async () => {
		const content = [
			"```text",
			`https://youtu.be/${VIDEO_ID}`,
			"```",
			`\`https://youtube.com/watch?v=${VIDEO_ID}\``,
		].join("\n");

		expect(await extractFirstYouTubeThumbnail(content)).toBeUndefined();
	});

	test("stops at the scan budget", async () => {
		const content = `prefix ${"x".repeat(30)} https://youtu.be/${VIDEO_ID}`;

		expect(
			await extractFirstYouTubeThumbnail(content, { maxScanChars: 20 }),
		).toBeUndefined();
	});

	test("yields during long scans and observes abort", async () => {
		const controller = new AbortController();
		const yieldToMainThread = vi.fn(async () => controller.abort());
		const content = `youtube.com ${"x".repeat(100)} https://youtu.be/${VIDEO_ID}`;

		expect(
			await extractFirstYouTubeThumbnail(content, {
				signal: controller.signal,
				yieldEveryChars: 10,
				yieldToMainThread,
			}),
		).toBeUndefined();
		expect(yieldToMainThread).toHaveBeenCalled();
	});
});
