import type { CachedMetadata, TFile } from "obsidian";
import type { PreviewData } from "../types";
import type { IMetadataCache, IVault } from "obsidian-integration/hostContracts";
import { parsePriorityPropertyKeys } from "shared/metadata/parsePriorityPropertyKeys";
import { resolveFile } from "../pipeline/previewContent";
import { isFileUrlImage, toObsidianResourceUrl } from "./externalImageSource";

function getMetadata(
	file: TFile,
	metadataCache: IMetadataCache,
): CachedMetadata | null {
	return metadataCache.getFileCache(file);
}

export async function getFrontmatterImage(
	file: TFile,
	metadataCache: IMetadataCache,
	vault: IVault,
	frontmatterKeys: string,
): Promise<PreviewData | undefined> {
	const frontmatter = getMetadata(file, metadataCache)?.frontmatter;
	if (!frontmatter) return undefined;

	for (const key of parsePriorityPropertyKeys(frontmatterKeys)) {
		const values = getImagePropertyValues(frontmatter[key]);
		for (const value of values) {
			const preview = resolveImagePropertyValue(value, metadataCache, vault);
			if (preview) return preview;
		}
	}

	return undefined;
}

function getImagePropertyValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function resolveImagePropertyValue(
	value: string,
	metadataCache: IMetadataCache,
	vault: IVault,
): PreviewData | undefined {
	const imageUrl = value.trim();
	if (!imageUrl) return undefined;

	if (imageUrl.startsWith("http")) {
		return { type: "image", content: imageUrl };
	}

	if (isFileUrlImage(imageUrl)) {
		return { type: "image", content: toObsidianResourceUrl(imageUrl) };
	}

	const imageFileLink = imageUrl.match(/^\[\[([^\]]+)\]\]$/);
	if (!imageFileLink) return undefined;

	const imageFile = resolveFile(imageFileLink[1], metadataCache);
	if (!imageFile) return undefined;

	return {
		type: "image",
		content: vault.getResourcePath(imageFile),
	};
}

export function generateImagePreview(file: TFile, vault: IVault): PreviewData {
	return {
		type: "image",
		content: vault.getResourcePath(file),
	};
}
