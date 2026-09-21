import type { CooperativeScanOptions } from "./fencedCodeBlocks";
import { extractFirstMatchingHttpUrl } from "./externalUrlScanner";

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

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
	return await extractFirstMatchingHttpUrl(content, createYouTubeThumbnailSource, {
		...options,
		candidateSubstrings: ["youtu.be", "youtube.com"],
	});
}
