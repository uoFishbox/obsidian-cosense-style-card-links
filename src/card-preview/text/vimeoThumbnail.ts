import { requestUrl } from "obsidian";
import type { CooperativeScanOptions } from "./fencedCodeBlocks";
import { extractFirstMatchingHttpUrl } from "./externalUrlScanner";

const VIMEO_VIDEO_ID_PATTERN = /^\d+$/;

export interface VimeoVideoSource {
	readonly videoId: string;
	readonly videoUrl: string;
}

/** Returns Vimeo video identity for standard, channel, group, and player URLs. */
export function getVimeoVideoSource(input: string): VimeoVideoSource | undefined {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return undefined;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;

	const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
	if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") {
		return undefined;
	}

	const pathSegments = url.pathname.split("/").filter(Boolean);
	let videoId: string | undefined;
	for (let index = pathSegments.length - 1; index >= 0; index--) {
		if (!VIMEO_VIDEO_ID_PATTERN.test(pathSegments[index])) continue;
		videoId = pathSegments[index];
		break;
	}
	if (!videoId) return undefined;

	return { videoId, videoUrl: url.toString() };
}

/** Finds the first supported Vimeo URL outside inline and fenced code. */
export async function extractFirstVimeoVideo(
	content: string,
	options: CooperativeScanOptions = {},
): Promise<VimeoVideoSource | undefined> {
	return await extractFirstMatchingHttpUrl(content, getVimeoVideoSource, {
		...options,
		candidateSubstrings: ["vimeo.com"],
	});
}

/** Resolves a Vimeo thumbnail through Vimeo's official oEmbed endpoint. */
export async function resolveVimeoThumbnailUrl(
	videoUrl: string,
	signal?: AbortSignal,
): Promise<string | undefined> {
	if (signal?.aborted) return undefined;

	const endpoint = new URL("https://vimeo.com/api/oembed.json");
	endpoint.searchParams.set("url", videoUrl);
	const response = await requestUrl({ url: endpoint.toString(), throw: false });
	if (signal?.aborted || response.status < 200 || response.status >= 300) {
		return undefined;
	}

	const responseJson: unknown = response.json;
	if (!isVimeoOEmbedResponse(responseJson)) return undefined;

	try {
		const thumbnailUrl = new URL(responseJson.thumbnail_url);
		return thumbnailUrl.protocol === "http:" || thumbnailUrl.protocol === "https:"
			? thumbnailUrl.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

function isVimeoOEmbedResponse(
	value: unknown,
): value is { readonly thumbnail_url: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"thumbnail_url" in value &&
		typeof value.thumbnail_url === "string" &&
		value.thumbnail_url.length > 0
	);
}
