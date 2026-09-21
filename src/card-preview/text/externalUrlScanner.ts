import {
	detectFenceStart,
	skipFencedCodeBlockAsync,
	type CooperativeScanOptions,
} from "./fencedCodeBlocks";

const NEWLINE_CHAR_CODE = 10;
const URL_TERMINATORS = new Set(["<", ">", '"', "'", ")", "]", "}"]);
const TRAILING_URL_PUNCTUATION = /[.,;:!?]+$/;

export interface ExternalUrlScanOptions extends CooperativeScanOptions {
	/** Avoids a character-by-character scan when none of these lowercase tokens exist. */
	readonly candidateSubstrings?: readonly string[];
}

/** Finds the first matching HTTP(S) URL outside inline and fenced code. */
export async function extractFirstMatchingHttpUrl<T>(
	content: string,
	matchUrl: (url: string) => T | undefined,
	options: ExternalUrlScanOptions = {},
): Promise<T | undefined> {
	const scanEnd = Math.min(
		content.length,
		Math.max(options.maxScanChars ?? content.length, 0),
	);
	if (scanEnd === 0) return undefined;

	const candidateContent = content.substring(0, scanEnd);
	const lowerContent = candidateContent.toLowerCase();
	if (
		options.candidateSubstrings?.length &&
		!options.candidateSubstrings.some((token) => lowerContent.includes(token))
	) {
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
			const result = matchUrl(rawUrl);
			if (result !== undefined) return result;
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
