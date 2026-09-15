import { getOptionalOwnerWindow } from "shared/ui/dom/realmSafeDom";
import { findNearestScrollContainer } from "./scrollContainer";

/** Absolute position captured from the scroll surface containing a result set. */
export interface CapturedScrollPosition {
	readonly scrollTop: number;
	readonly scrollRoot: HTMLElement | null;
}

/** Captures the parent scroll offset without tying it to rendered content. */
export function captureScrollPosition(
	rootEl: HTMLElement | null,
	knownScrollRoot?: HTMLElement | null,
): CapturedScrollPosition | null {
	if (!rootEl) return null;
	const ownerWindow = getOptionalOwnerWindow(rootEl);
	if (!ownerWindow) return null;

	const scrollRoot = knownScrollRoot ?? findNearestScrollContainer(rootEl);
	return {
		scrollTop: scrollRoot?.scrollTop ?? ownerWindow.scrollY,
		scrollRoot,
	};
}

/** Restores an absolute parent scroll offset after result-set DOM replacement. */
export function restoreScrollPosition(
	position: CapturedScrollPosition | null,
	rootEl: HTMLElement | null,
): { readonly delta: number; readonly scrollTop: number } | null {
	if (!position || !rootEl) return null;
	const ownerWindow = getOptionalOwnerWindow(rootEl);
	if (!ownerWindow) return null;

	const currentScrollRoot = findNearestScrollContainer(rootEl);
	if (currentScrollRoot !== position.scrollRoot) return null;

	const currentScrollTop = currentScrollRoot?.scrollTop ?? ownerWindow.scrollY;
	if (Math.abs(currentScrollTop - position.scrollTop) >= 0.5) {
		if (currentScrollRoot) currentScrollRoot.scrollTop = position.scrollTop;
		else ownerWindow.scrollBy({ top: position.scrollTop - currentScrollTop });
	}
	const restoredScrollTop = currentScrollRoot?.scrollTop ?? ownerWindow.scrollY;
	return {
		delta: restoredScrollTop - currentScrollTop,
		scrollTop: restoredScrollTop,
	};
}
