import { tick } from "svelte";
import {
	captureScrollPosition,
	restoreScrollPosition,
	type CapturedScrollPosition,
} from "shared/ui/scroll/scrollPositionRestoration";

export interface FlatGridScrollRestorationOptions {
	getRootEl(): HTMLElement | null;
	getScrollContainerEl(): HTMLElement | null;
	suppressNextNativeScroll(scrollTop: number): void;
	runDataChangeMeasurement(): void;
}

export interface FlatGridScrollRestorationController {
	preserveScrollPosition(): void;
	scheduleAfterSnapshot(): void;
	dispose(): void;
}

/** Restores a flat grid's parent scroll offset after a result-set replacement. */
export function createFlatGridScrollRestorationController(
	options: FlatGridScrollRestorationOptions,
): FlatGridScrollRestorationController {
	let pendingPosition: CapturedScrollPosition | null = null;
	let postCommitScheduled = false;
	let disposed = false;

	function preserveScrollPosition(): void {
		if (pendingPosition) return;
		pendingPosition = captureScrollPosition(
			options.getRootEl(),
			options.getScrollContainerEl(),
		);
	}

	function scheduleAfterSnapshot(): void {
		if (!pendingPosition || postCommitScheduled) return;
		postCommitScheduled = true;
		void tick().then(restoreAfterCommit);
	}

	function restoreAfterCommit(): void {
		postCommitScheduled = false;
		if (disposed || !pendingPosition) return;

		const rootEl = options.getRootEl();
		// An empty result temporarily removes CardGridSurface. Keep the captured
		// position until a later publication mounts the surface again.
		if (!rootEl) return;

		const position = pendingPosition;
		pendingPosition = null;
		const restoration = restoreScrollPosition(position, rootEl);
		if (restoration && restoration.delta !== 0) {
			options.suppressNextNativeScroll(restoration.scrollTop);
		}
		options.runDataChangeMeasurement();
	}

	function dispose(): void {
		disposed = true;
		pendingPosition = null;
	}

	return { preserveScrollPosition, scheduleAfterSnapshot, dispose };
}
