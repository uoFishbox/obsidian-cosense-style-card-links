import {
	detectFenceStart,
	skipFencedCodeBlockAsync,
	type CooperativeScanOptions,
} from "./fencedCodeBlocks";

const NEWLINE_CHAR_CODE = 10;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const URL_TERMINATORS = new Set(["<", ">", '"', "'", ")", "]", "}"]);
const TRAILING_URL_PUNCTUATION = /[.,;:!?]+$/;

export interface YouTubeThumbnailSource {
	readonly videoId: string;
	readonly maxResolutionUrl: string;
	readonly fallbackUrl: string;
}

/** Returns a YouTube video ID for supported watch, short, embed, and short-link URLs. */
export function getYouTubeVideoId(input: string): string | undefined {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return undefined;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

	const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
	let videoId: string | null | undefined;

	if (hostname === "youtu.be") {
		videoId = url.pathname.split("/").filter(Boolean)[0];
	} else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
		const pathSegments = url.pathname.split("/").filter(Boolean);
		if (url.pathname === "/watch") {
			videoId = url.searchParams.get("v");
		} else if (pathSegments[0] === "shorts" || pathSegments[0] === "embed") {
			videoId = pathSegments[1];
		}
	}

	return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : undefined;
}

/** Builds maximum-resolution and reliable fallback thumbnail URLs. */
export function createYouTubeThumbnailSource(
	input: string,
): YouTubeThumbnailSource | undefined {
	const videoId = getYouTubeVideoId(input);
	if (!videoId) return undefined;

	const baseUrl = `https://img.youtube.com/vi/${videoId}`;
	return {
		videoId,
		maxResolutionUrl: `${baseUrl}/maxresdefault.jpg`,
		fallbackUrl: `${baseUrl}/hqdefault.jpg`,
	};
}

/** Finds the first supported YouTube URL outside inline and fenced code. */
export async function extractFirstYouTubeThumbnail(
	content: string,
	options: CooperativeScanOptions = {},
): Promise<YouTubeThumbnailSource | undefined> {
	const scanEnd = Math.min(
		content.length,
		Math.max(options.maxScanChars ?? content.length, 0),
	);
	if (scanEnd === 0) return undefined;

	const candidateContent = content.substring(0, scanEnd);
	const lowerContent = candidateContent.toLowerCase();
	if (!lowerContent.includes("youtu.be") && !lowerContent.includes("youtube.com")) {
		return undefined;
	}

	const yieldEveryChars = options.yieldEveryChars ?? 20_000;
	let lastYieldIndex = 0;
	let index = 0;
	let atLineStart = true;

	while (index < scanEnd) {
		if (options.signal?.aborted) return undefined;
		if (options.yieldToMainThread && index - lastYieldIndex >= yieldEveryChars) {
			await options.yieldToMainThread();
			lastYieldIndex = index;
			if (options.signal?.aborted) return undefined;
		}

		if (atLineStart && detectFenceStart(candidateContent, index)) {
			index = await skipFencedCodeBlockAsync(candidateContent, index, options);
			atLineStart = true;
			continue;
		}

		const charCode = candidateContent.charCodeAt(index);
		if (charCode === NEWLINE_CHAR_CODE) {
			index++;
			atLineStart = true;
			continue;
		}
		atLineStart = false;

		if (candidateContent[index] === "`") {
			index = skipInlineCode(candidateContent, index);
			continue;
		}

		if (
			lowerContent.startsWith("https://", index) ||
			lowerContent.startsWith("http://", index)
		) {
			const urlEnd = findUrlEnd(candidateContent, index, scanEnd);
			const rawUrl = candidateContent
				.slice(index, urlEnd)
				.replace(TRAILING_URL_PUNCTUATION, "");
			const thumbnail = createYouTubeThumbnailSource(rawUrl);
			if (thumbnail) return thumbnail;
			index = Math.max(urlEnd, index + 1);
			continue;
		}

		index++;
	}

	return undefined;
}

function findUrlEnd(content: string, startIndex: number, scanEnd: number): number {
	let index = startIndex;
	while (index < scanEnd) {
		const character = content[index];
		if (/\s/.test(character) || URL_TERMINATORS.has(character)) break;
		index++;
	}
	return index;
}

function skipInlineCode(content: string, startIndex: number): number {
	let fenceEnd = startIndex + 1;
	while (content[fenceEnd] === "`") fenceEnd++;

	const fence = content.slice(startIndex, fenceEnd);
	const closingIndex = content.indexOf(fence, fenceEnd);
	if (closingIndex === -1) return startIndex + 1;

	const newlineIndex = content.indexOf("\n", fenceEnd);
	if (newlineIndex !== -1 && newlineIndex < closingIndex) return startIndex + 1;
	return closingIndex + fence.length;
}
