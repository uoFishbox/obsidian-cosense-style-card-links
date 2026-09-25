type ScrollActivityListener = (isActive: boolean) => void;
type ScrollTarget = Window | HTMLElement;
type ScrollerScrollActivityListener = (target: ScrollTarget, isActive: boolean) => void;

const activeSources = new Map<object, ScrollTarget>();
const activeTargetCounts = new Map<ScrollTarget, number>();
const listeners = new Set<ScrollActivityListener>();
const scrollerListeners = new Set<ScrollerScrollActivityListener>();

function emit(isActive: boolean): void {
	for (const listener of listeners) {
		listener(isActive);
	}
}

export function isScrollActivityActive(): boolean {
	return activeSources.size > 0;
}

/** Returns whether a particular scroll target has an active scroll session. */
export function isScrollerScrollActivityActive(target: ScrollTarget): boolean {
	return activeTargetCounts.has(target);
}

function emitScroller(target: ScrollTarget, isActive: boolean): void {
	for (const listener of scrollerListeners) {
		listener(target, isActive);
	}
}

/** Starts activity for one source on its owning scroll target. */
export function markScrollActivityActive(source: object, target: ScrollTarget): void {
	if (activeSources.has(source)) return;
	const wasActive = isScrollActivityActive();
	const targetCount = activeTargetCounts.get(target) ?? 0;
	activeSources.set(source, target);
	activeTargetCounts.set(target, targetCount + 1);
	if (targetCount === 0) emitScroller(target, true);
	if (!wasActive && isScrollActivityActive()) {
		emit(true);
	}
}

/** Ends activity for one source, retaining other active scroll targets. */
export function markScrollActivityIdle(source: object): void {
	const target = activeSources.get(source);
	if (!target) return;
	activeSources.delete(source);
	const remainingCount = (activeTargetCounts.get(target) ?? 1) - 1;
	if (remainingCount === 0) {
		activeTargetCounts.delete(target);
		emitScroller(target, false);
	} else {
		activeTargetCounts.set(target, remainingCount);
	}

	if (!isScrollActivityActive()) {
		emit(false);
	}
}

export function subscribeScrollActivity(listener: ScrollActivityListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Subscribes to activity changes with the originating scroll target. */
export function subscribeScrollerScrollActivity(
	listener: ScrollerScrollActivityListener,
): () => void {
	scrollerListeners.add(listener);
	return () => {
		scrollerListeners.delete(listener);
	};
}

export function resetScrollActivityForTests(): void {
	if (activeSources.size === 0) {
		return;
	}

	activeSources.clear();
	const targets = [...activeTargetCounts.keys()];
	activeTargetCounts.clear();
	for (const target of targets) emitScroller(target, false);
	emit(false);
}
