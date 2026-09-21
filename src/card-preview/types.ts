import type { Component } from "obsidian";
import type { PreviewRenderSettings } from "./pipeline/previewRenderSettings";

export type PreviewDomRenderer = (
	container: HTMLElement,
	component: Component,
	signal?: AbortSignal,
) => Promise<void>;

export type PreviewDomAttachment = "host-bound" | "resource-bound";

export type PreviewData =
	| {
			type: "text";
			content: string;
	  }
	| {
			type: "image";
			content: string;
			/** Used once when the primary external image cannot be loaded. */
			fallbackContent?: string;
			byteSize?: number;
	  }
	| {
			type: "empty";
			content: string;
	  }
	| {
			type: "dom";
			content?: never;
			/**
			 * `resource-bound` DOM may move between hosts while its renderer-owned
			 * resources remain alive. Omitted values remain fixed to their host.
			 */
			attachment?: PreviewDomAttachment;
			render: PreviewDomRenderer;
	  };

export interface PreviewRequestOptions {
	cacheRevision?: number | string;
	/** Immutable render settings for the card geometry that initiated the request. */
	renderSettings?: PreviewRenderSettings;
}
