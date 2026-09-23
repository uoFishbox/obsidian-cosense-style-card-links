import type { TFile } from "obsidian";
import { defaultYieldToMainThread } from "indexing/timeSlicing";
import { resolveWorkspaceDocument } from "obsidian-integration/workspace/workspaceDocuments";
import { parsePriorityPropertyKeys } from "shared/metadata/parsePriorityPropertyKeys";
import type { PreviewData } from "../types";
import { generateCanvasPreview } from "../renderers/canvasPreviewRenderer";
import {
	generateImagePreview,
	getFrontmatterImage,
} from "../renderers/imagePreviewRenderer";
import { generateVideoPreview } from "../renderers/videoPreviewRenderer";
import { getContentSnippetAsync } from "../text/previewTextProcessingAsync";
import {
	extractFirstVimeoVideo,
	resolveVimeoThumbnailUrl,
} from "../text/vimeoThumbnail";
import { extractFirstYouTubeThumbnail } from "../text/youtubeThumbnail";
import { resolveEmbeddedMediaPreview } from "../strategies/EmbeddedMediaStrategy";
import { createAbortError, isAbortError } from "./previewAbort";
import { isCanvas, isImage, isSource, isVideo } from "./previewContent";
import type { PreviewContext } from "./previewContext";

type OptionalPreviewResolver = (
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
) => Promise<PreviewData | undefined>;

/** Resolves previews in the fixed production fallback order. */
export async function resolvePreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData> {
	if (signal?.aborted) throw createAbortError();

	if (isImage(file)) {
		return (
			(await tryResolve(resolveImagePreview, file, context, signal)) ??
			emptyPreview()
		);
	}
	if (isVideo(file)) {
		return (
			(await tryResolve(resolveVideoPreview, file, context, signal)) ??
			emptyPreview()
		);
	}
	if (isCanvas(file)) {
		return (
			(await tryResolve(resolveCanvasPreview, file, context, signal)) ??
			emptyPreview()
		);
	}
	if (file.extension === "md") {
		return resolveMarkdownPreview(file, context, signal);
	}
	if (isSource(file)) {
		return (
			(await tryResolve(resolveTextSnippetPreview, file, context, signal)) ??
			emptyPreview()
		);
	}

	return emptyPreview();
}

async function resolveMarkdownPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData> {
	return (
		(await tryResolve(resolveFrontmatterPropertyPreview, file, context, signal)) ??
		(await tryResolve(resolveFrontmatterImagePreview, file, context, signal)) ??
		(await tryResolve(resolveEmbeddedMediaPreview, file, context, signal)) ??
		(await tryResolve(resolveYouTubeThumbnailPreview, file, context, signal)) ??
		(await tryResolve(resolveVimeoThumbnailPreview, file, context, signal)) ??
		(await tryResolve(resolveTextSnippetPreview, file, context, signal)) ??
		emptyPreview()
	);
}

function emptyPreview(): PreviewData {
	return { type: "empty", content: "" };
}

async function tryResolve(
	resolver: OptionalPreviewResolver,
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) throw createAbortError();
	try {
		const result = await resolver(file, context, signal);
		if (signal?.aborted) throw createAbortError();
		return result;
	} catch (error) {
		if (isAbortError(error)) throw error;
		console.warn("Preview resolver failed:", error);
		return undefined;
	}
}

async function resolveFrontmatterPropertyPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	const frontmatter = context.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter) return undefined;

	for (const key of parsePriorityPropertyKeys(
		context.settings.priorityFrontmatterKeyForPreview,
	)) {
		const value = frontmatter[key];
		if (value === undefined || value === null || value === "") continue;

		let content: string;
		if (typeof value === "string") content = value;
		else if (Array.isArray(value)) content = value.join(", ");
		else if (typeof value === "object") content = JSON.stringify(value);
		else content = String(value);

		const trimmedContent = content.trim();
		if (trimmedContent) return { type: "text", content: trimmedContent };
	}

	return undefined;
}

async function resolveImagePreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	return generateImagePreview(file, context.vault);
}

async function resolveVideoPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	return await generateVideoPreview(
		file,
		signal,
		resolveWorkspaceDocument(context.app.workspace),
	);
}

async function resolveCanvasPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	return await generateCanvasPreview(file, context.app, signal);
}

async function resolveFrontmatterImagePreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	return await getFrontmatterImage(
		file,
		context.metadataCache,
		context.vault,
		context.settings.priorityFrontmatterKeysForImagePreview,
	);
}

async function resolveYouTubeThumbnailPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (file.extension !== "md" || signal?.aborted) return undefined;

	const content = await context.getContent(signal);
	const thumbnail = await extractFirstYouTubeThumbnail(content, {
		maxScanChars: 200_000,
		yieldToMainThread: defaultYieldToMainThread,
		signal,
	});
	if (!thumbnail || signal?.aborted) return undefined;

	return {
		type: "image",
		content: thumbnail.maxResolutionUrl,
		fallbackContent: thumbnail.fallbackUrl,
	};
}

async function resolveVimeoThumbnailPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (file.extension !== "md" || signal?.aborted) return undefined;

	const content = await context.getContent(signal);
	const video = await extractFirstVimeoVideo(content, {
		maxScanChars: 200_000,
		yieldToMainThread: defaultYieldToMainThread,
		signal,
	});
	if (!video || signal?.aborted) return undefined;

	const thumbnailUrl = await resolveVimeoThumbnailUrl(video.videoUrl, signal);
	return thumbnailUrl ? { type: "image", content: thumbnailUrl } : undefined;
}

async function resolveTextSnippetPreview(
	file: TFile,
	context: PreviewContext,
	signal?: AbortSignal,
): Promise<PreviewData | undefined> {
	if (signal?.aborted) return undefined;
	const content = await context.getContent(signal);
	if (signal?.aborted || !content) return undefined;
	const snippet = await getContentSnippetAsync(
		content,
		context.settings,
		undefined,
		undefined,
		signal,
	);
	if (!snippet) return { type: "empty", content: "" };
	return { type: "text", content: snippet };
}
