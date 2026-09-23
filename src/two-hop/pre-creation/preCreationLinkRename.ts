import { getLinkpath, type App, type TFile } from "obsidian";
import {
	normalizeLinkToMarkdownPath,
	resolveLinkDestination,
	toCaseInsensitiveLookupKey,
} from "indexing/link-resolution/linkResolution";
import type { IIndexingService } from "indexing/index-service/IndexingService";
import type { CachedMetadataWithLinkReferences, LinkReference } from "indexing/model";
import { defaultYieldToMainThread } from "indexing/timeSlicing";

export interface PreCreationRenameResult {
	filesUpdated: number;
	linksUpdated: number;
	failed: { path: string; reason: string }[];
}

export interface IndexUpdateBatch {
	beginBatch(): () => void;
}

/**
 * Rename an unresolved wikilink target without materializing either target as a file.
 *
 * This intentionally follows Orbital's rewrite strategy rather than relying on
 * FileManager.renameFile(): use the link index to narrow the source files, then
 * splice cached link/embedding ranges from the end of each Markdown document so
 * offsets remain valid. Canvas files are rewritten through their JSON node model.
 * Markdown frontmatter is handled separately through processFrontMatter.
 */
export async function renamePreCreationUnresolvedLinks(
	app: App,
	indexingService: IIndexingService,
	indexUpdateBatch: IndexUpdateBatch,
	fromLinktext: string,
	toLinktext: string,
): Promise<PreCreationRenameResult> {
	const fromPath = normalizeLookupPath(fromLinktext);
	const toTarget = getLinkpath(toLinktext);
	const result: PreCreationRenameResult = {
		filesUpdated: 0,
		linksUpdated: 0,
		failed: [],
	};

	if (!fromPath || !toTarget || fromPath === normalizeLookupPath(toLinktext)) {
		return result;
	}

	await indexingService.awaitIdle();
	const candidates = new Map(
		indexingService
			.getUniqueBacklinkSourcesForLink(fromPath)
			.map((link) => [link.sourceFile.path, link.sourceFile] as const),
	);

	const endBatch = indexUpdateBatch.beginBatch();
	try {
		let inspected = 0;
		for (const file of candidates.values()) {
			if (file.extension !== "md" && file.extension !== "canvas") continue;
			if (++inspected % 10 === 0) await defaultYieldToMainThread();

			try {
				if (file.extension === "canvas") {
					const changed = await rewriteCanvasLinks(
						app,
						file,
						fromPath,
						toTarget,
					);
					if (changed > 0) {
						result.filesUpdated++;
						result.linksUpdated += changed;
					}
					continue;
				}

				const bodyCount = await rewriteBodyLinks(app, file, fromPath, toTarget);
				const frontmatterCount = await rewriteFrontmatterLinks(
					app,
					file,
					fromPath,
					toTarget,
				);
				const changed = bodyCount + frontmatterCount;
				if (changed > 0) {
					result.filesUpdated++;
					result.linksUpdated += changed;
				}
			} catch (error) {
				result.failed.push({
					path: file.path,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}
	} finally {
		endBatch();
	}

	await indexingService.awaitIdle();
	return result;
}

async function rewriteBodyLinks(
	app: App,
	file: TFile,
	fromPath: string,
	toTarget: string,
): Promise<number> {
	let replaced = 0;
	await app.vault.process(file, (data) => {
		const cache = app.metadataCache.getFileCache(
			file,
		) as CachedMetadataWithLinkReferences | null;
		if (!cache) return data;

		const refs = [...(cache.links ?? []), ...(cache.embeds ?? [])]
			.filter((ref) => isMatchingUnresolvedReference(app, file, ref, fromPath))
			.sort((a, b) => b.position.start.offset - a.position.start.offset);
		if (refs.length === 0) return data;

		let out = data;
		let lastStart = data.length;
		let count = 0;
		for (const ref of refs) {
			const start = ref.position.start.offset;
			const end = ref.position.end.offset;
			if (
				start < 0 ||
				end > lastStart ||
				end > data.length ||
				data.slice(start, end) !== ref.original
			) {
				throw new Error("Metadata is stale; retry after indexing");
			}
			const replacement = rewriteReferenceOriginal(
				ref.original,
				ref.link,
				toTarget,
			);
			if (replacement === null) {
				throw new Error(
					"Unsupported link format; no links in this file were changed",
				);
			}
			out = out.slice(0, start) + replacement + out.slice(end);
			lastStart = start;
			count++;
		}
		replaced = count;
		return out;
	});
	return replaced;
}

async function rewriteCanvasLinks(
	app: App,
	file: TFile,
	fromPath: string,
	toTarget: string,
): Promise<number> {
	let replaced = 0;
	await app.vault.process(file, (data) => {
		const canvas: unknown = JSON.parse(data);
		if (!isRecord(canvas) || !Array.isArray(canvas.nodes)) return data;

		for (const value of canvas.nodes) {
			if (!isRecord(value)) continue;

			if (value.type === "file" && typeof value.file === "string") {
				const reference = { link: value.file } as LinkReference;
				if (isMatchingUnresolvedReference(app, file, reference, fromPath)) {
					value.file = normalizeLinkToMarkdownPath(toTarget);
					replaced++;
				}
				continue;
			}

			if (value.type !== "text" || typeof value.text !== "string") continue;
			const rewritten = rewriteWikilinksInString(
				app,
				file,
				value.text,
				fromPath,
				toTarget,
			);
			value.text = rewritten.value;
			replaced += rewritten.count;
		}

		return replaced > 0 ? serializeCanvas(canvas, data) : data;
	});
	return replaced;
}

function serializeCanvas(canvas: Record<string, unknown>, original: string): string {
	const indentation = original.match(/\r?\n([\t ]+)"/)?.[1];
	const newline = original.includes("\r\n") ? "\r\n" : "\n";
	const hasFinalNewline = original.endsWith("\n");
	let serialized = JSON.stringify(canvas, null, indentation);
	if (newline === "\r\n") serialized = serialized.split("\n").join(newline);
	return hasFinalNewline ? `${serialized}${newline}` : serialized;
}

async function rewriteFrontmatterLinks(
	app: App,
	file: TFile,
	fromPath: string,
	toTarget: string,
): Promise<number> {
	const cache = app.metadataCache.getFileCache(
		file,
	) as CachedMetadataWithLinkReferences | null;
	const frontmatterLinks = cache?.frontmatterLinks ?? [];
	if (
		!frontmatterLinks.some((ref) =>
			isMatchingUnresolvedReference(app, file, ref, fromPath),
		)
	) {
		return 0;
	}

	let replaced = 0;
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		if (!isRecord(frontmatter)) return;

		for (const key of Object.keys(frontmatter)) {
			const value = frontmatter[key];
			if (typeof value === "string") {
				const rewritten = rewriteWikilinksInString(
					app,
					file,
					value,
					fromPath,
					toTarget,
				);
				frontmatter[key] = rewritten.value;
				replaced += rewritten.count;
			} else if (Array.isArray(value)) {
				frontmatter[key] = value.map((item) => {
					if (typeof item !== "string") return item;
					const rewritten = rewriteWikilinksInString(
						app,
						file,
						item,
						fromPath,
						toTarget,
					);
					replaced += rewritten.count;
					return rewritten.value;
				});
			}
		}
	});
	return replaced;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rewriteWikilinksInString(
	app: App,
	file: TFile,
	value: string,
	fromPath: string,
	toTarget: string,
): { value: string; count: number } {
	const matches = Array.from(value.matchAll(/!?\[\[[^\]]*\]\]/g));
	let out = value;
	let count = 0;
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i]!;
		const original = match[0];
		const start = match.index!;
		const parsed = parseWikilink(original);
		if (!parsed) continue;
		const reference = { link: parsed.bodyWithoutAlias } as LinkReference;
		if (!isMatchingUnresolvedReference(app, file, reference, fromPath)) continue;
		const replacement = rewriteParsedWikilink(parsed, toTarget);
		out = out.slice(0, start) + replacement + out.slice(start + original.length);
		count++;
	}
	return { value: out, count };
}

function isMatchingUnresolvedReference(
	app: App,
	file: TFile,
	ref: LinkReference,
	fromPath: string,
): boolean {
	const resolution = resolveLinkDestination(app.metadataCache, ref, file.path);
	return (
		resolution.isUnresolved &&
		toCaseInsensitiveLookupKey(resolution.lookupPath) ===
			toCaseInsensitiveLookupKey(fromPath)
	);
}

function rewriteReferenceOriginal(
	original: string,
	link: string,
	toTarget: string,
): string | null {
	const parsed = parseWikilink(original);
	if (parsed) return rewriteParsedWikilink(parsed, toTarget);

	// Markdown links and embeds are also present in metadataCache.links/embeds.
	// Change only their destination, preserving label, title, and syntax.
	const opening = original.lastIndexOf("](");
	if (opening < 0) return null;
	const linkStart = original.indexOf(link, opening + 2);
	if (linkStart < 0) return null;
	const linkEnd = linkStart + link.length;
	const destinationPrefix = original.slice(opening + 2, linkStart);
	const suffix = original.slice(linkEnd);
	if (
		!/^\s*<?$/u.test(destinationPrefix) ||
		!/^>?\s*(?:(?:"[^"]*"|'[^']*')\s*)?\)$/u.test(suffix)
	) {
		return null;
	}

	const anchorIndex = link.indexOf("#");
	const subpath = anchorIndex >= 0 ? link.slice(anchorIndex) : "";
	const originalTarget = anchorIndex >= 0 ? link.slice(0, anchorIndex) : link;
	const target = originalTarget.toLowerCase().endsWith(".md")
		? normalizeLinkToMarkdownPath(toTarget)
		: toTarget;
	return `${original.slice(0, linkStart)}${target}${subpath}${suffix}`;
}

interface ParsedWikilink {
	embed: boolean;
	subpath: string;
	alias: string;
	bodyWithoutAlias: string;
}

function parseWikilink(original: string): ParsedWikilink | null {
	const embed = original.startsWith("!");
	const raw = embed ? original.slice(1) : original;
	if (!raw.startsWith("[[") || !raw.endsWith("]]")) return null;
	const body = raw.slice(2, -2);
	const pipeIndex = body.indexOf("|");
	const beforeAlias = pipeIndex >= 0 ? body.slice(0, pipeIndex) : body;
	const alias = pipeIndex >= 0 ? body.slice(pipeIndex + 1) : "";
	const hashIndex = beforeAlias.indexOf("#");
	const target = hashIndex >= 0 ? beforeAlias.slice(0, hashIndex) : beforeAlias;
	const subpath = hashIndex >= 0 ? beforeAlias.slice(hashIndex) : "";
	if (!target) return null;
	return {
		embed,
		subpath,
		alias,
		bodyWithoutAlias: `${target}${subpath}`,
	};
}

function rewriteParsedWikilink(parsed: ParsedWikilink, toTarget: string): string {
	const prefix = parsed.embed ? "![[" : "[[";
	const alias = parsed.alias ? `|${parsed.alias}` : "";
	return `${prefix}${toTarget}${parsed.subpath}${alias}]]`;
}

function normalizeLookupPath(linktext: string): string {
	return linktext ? normalizeLinkToMarkdownPath(linktext) : "";
}
