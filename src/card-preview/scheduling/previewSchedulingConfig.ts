/** Scroll-time text commit limit; the image limit scales with this value. */
export const DEFAULT_PREVIEW_DOM_COMMITS_PER_SECOND = 96;
export const MIN_PREVIEW_DOM_COMMITS_PER_SECOND = 24;
export const MAX_PREVIEW_DOM_COMMITS_PER_SECOND = 170;
export const PREVIEW_DOM_COMMITS_STEP = 2;

/** Derives the stricter image limit from the text limit (96:20 by default). */
export function resolvePreviewImageDomCommitsPerSecond(
	textCommitsPerSecond: number,
): number {
	const textRate =
		Number.isFinite(textCommitsPerSecond) && textCommitsPerSecond > 0
			? textCommitsPerSecond
			: DEFAULT_PREVIEW_DOM_COMMITS_PER_SECOND;
	return (textRate * 5) / 24;
}
