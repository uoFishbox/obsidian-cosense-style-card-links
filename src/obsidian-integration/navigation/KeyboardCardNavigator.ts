import { Notice } from "obsidian";
import {
	getResultTargetIdentity,
	LOAD_MORE_SELECTOR,
} from "cards/navigation/resultTargets";
import { querySelectorAllIncludingShadow } from "shared/ui/dom/shadowDom";
import { isElementVisible } from "shared/ui/dom/domUtils";
import { getScrollMetrics } from "cards/virtualization/public";
import {
	createOwnerMouseEvent,
	getOptionalOwnerWindow,
	isHTMLElementLike,
	isNodeLike,
} from "shared/ui/dom/realmSafeDom";
import {
	scheduleAfterAnimationFrames,
	type ScheduledFrameTask,
} from "shared/ui/scheduling/frame";
import {
	collectVisibleKeyboardNavigationRows,
	findKeyboardNavigationStart,
	KEYBOARD_ROW_TOP_TOLERANCE_PX,
	type KeyboardNavigationSurfaceRegistry,
	type KeyboardNavigationRow,
} from "./keyboardNavigationSurface";
import {
	centerKeyboardNavigationRow,
	estimateKeyboardNavigationScrollStep,
	findLastKeyboardNavigationRowIndex,
	resolveKeyboardNavigationScrollTarget,
	scrollKeyboardNavigationContainerBy,
} from "./keyboardNavigationScroll";
import type { Language } from "settings/model";
import { getMainUiTranslations } from "shared/i18n/mainUiTranslations";

export type {
	KeyboardNavigationSurfaceRegistry,
	KeyboardNavigationRow,
} from "./keyboardNavigationSurface";

const LONG_HINT_KEYS = ["a", "s", "d", "f", "j", "k", "l", ";"] as const;
const HANDLED_HINT_KEYS = new Set<string>(LONG_HINT_KEYS);

// Global keyboard mode owns its shortcuts before CardGrid's local keydown policy.
const GLOBAL_KEYBOARD_MODE_CAPTURE = true;

type WindowWithEventConstructor = Window & {
	Event: typeof Event;
};

export class KeyboardCardNavigator {
	private rootEl: HTMLElement | null = null;
	private rows: KeyboardNavigationRow[] = [];
	private selectedRowIndex = -1;
	private selectedItemIds = new Set<string>();
	private selectedElements: HTMLElement[] = [];
	private pendingLayoutTask: ScheduledFrameTask | null = null;
	private pendingLoadMoreObserver: MutationObserver | null = null;
	private keydownDocument: Document | null = null;
	private unregisterWindowMigration: (() => void) | null = null;
	private cachedScrollContainer: HTMLElement | null = null;
	private internalScrollDepth = 0;
	private internalScrollGraceTimer: number | null = null;
	private internalScrollGraceWindow: Window | null = null;
	private readonly internalScrollPositions = new Map<HTMLElement | Window, number>();
	private readonly handleDocumentKeydownBound = this.handleDocumentKeydown.bind(this);
	private readonly handleScrollBound = this.handleScroll.bind(this);
	private readonly handleWheelBound = this.handleWheel.bind(this);

	constructor(
		private readonly surfaceRegistry: KeyboardNavigationSurfaceRegistry,
		private readonly notify: (message: string) => void = (message) =>
			new Notice(message),
		private readonly getLanguage: () => Language = () => "en",
	) {}

	public toggle(): void {
		if (this.rootEl) {
			this.deactivate();
			return;
		}

		const targetSurface = this.surfaceRegistry.findBestVisibleSurface();
		if (!targetSurface) {
			this.notify(getMainUiTranslations(this.getLanguage()).noVisibleCardSurface);
			return;
		}

		this.activate(targetSurface);
	}

	public activate(rootEl: HTMLElement): void {
		this.deactivate();

		this.rootEl = rootEl;
		this.rootEl.classList.add("ccl-kb-nav-active");

		this.bindKeydownDocument();
		if (typeof this.rootEl.onWindowMigrated === "function") {
			this.unregisterWindowMigration = this.rootEl.onWindowMigrated(() => {
				this.bindKeydownDocument();
				this.cancelPendingLayoutTask();
				this.clearInternalScrollGrace();
				this.cachedScrollContainer = null;
				this.internalScrollPositions.clear();
				this.refreshRows(false);
			});
		}

		this.rootEl.focus({ preventScroll: true });

		if (!this.refreshRows(false) && !this.startAtFirstResult()) {
			this.notify(getMainUiTranslations(this.getLanguage()).noVisibleCards);
			this.deactivate();
		}
	}

	public deactivate(): void {
		this.unregisterWindowMigration?.();
		this.unregisterWindowMigration = null;
		this.unbindKeydownDocument();

		this.cancelPendingLayoutTask();
		this.clearInternalScrollGrace();

		this.clearSelectionState();

		if (this.rootEl) {
			this.rootEl.classList.remove("ccl-kb-nav-active");
		}

		this.rootEl = null;
		this.rows = [];
		this.selectedRowIndex = -1;
		this.selectedItemIds.clear();
		this.cachedScrollContainer = null;
		this.internalScrollPositions.clear();
	}

	private unbindKeydownDocument(): void {
		this.keydownDocument?.removeEventListener(
			"keydown",
			this.handleDocumentKeydownBound,
			GLOBAL_KEYBOARD_MODE_CAPTURE,
		);
		this.keydownDocument?.removeEventListener(
			"scroll",
			this.handleScrollBound,
			true,
		);
		this.keydownDocument?.removeEventListener("wheel", this.handleWheelBound, true);
		this.keydownDocument?.defaultView?.removeEventListener(
			"scroll",
			this.handleScrollBound,
			true,
		);
		this.keydownDocument = null;
	}

	private bindKeydownDocument(): void {
		const nextDocument = this.rootEl?.ownerDocument ?? null;
		if (this.keydownDocument === nextDocument) return;
		this.unbindKeydownDocument();
		this.keydownDocument = nextDocument;
		this.keydownDocument?.addEventListener(
			"keydown",
			this.handleDocumentKeydownBound,
			GLOBAL_KEYBOARD_MODE_CAPTURE,
		);
		this.keydownDocument?.addEventListener("scroll", this.handleScrollBound, true);
		this.keydownDocument?.addEventListener("wheel", this.handleWheelBound, true);
		this.keydownDocument?.defaultView?.addEventListener(
			"scroll",
			this.handleScrollBound,
			true,
		);
	}

	private isOwnerWindow(target: EventTarget | null): boolean {
		return (
			!!this.rootEl &&
			!!target &&
			"document" in target &&
			target.document === this.rootEl.ownerDocument
		);
	}

	private isSurfaceScrollTarget(target: EventTarget | null): boolean {
		if (!this.rootEl) return false;
		if (target === this.rootEl.ownerDocument || this.isOwnerWindow(target)) {
			return true;
		}
		return (
			isNodeLike(target) &&
			(this.rootEl.contains(target) || target.contains(this.rootEl))
		);
	}

	private handleScroll(event: Event): void {
		if (
			!this.isSurfaceScrollTarget(event.target) ||
			this.internalScrollDepth > 0 ||
			this.internalScrollGraceTimer !== null ||
			(this.selectedRowIndex < 0 && this.pendingLayoutTask !== null)
		) {
			return;
		}
		const target = event.target;
		if (isHTMLElementLike(target)) {
			if (this.internalScrollPositions.get(target) === target.scrollTop) return;
		} else if (this.isOwnerWindow(target)) {
			const ownerWindow = this.rootEl?.ownerDocument.defaultView;
			if (
				ownerWindow &&
				this.internalScrollPositions.get(ownerWindow) === ownerWindow.scrollY
			)
				return;
		}
		this.deactivate();
	}

	private handleWheel(event: WheelEvent): void {
		if (this.isSurfaceScrollTarget(event.target)) this.deactivate();
	}

	private clearInternalScrollGrace(): void {
		if (this.internalScrollGraceTimer !== null) {
			this.internalScrollGraceWindow?.clearTimeout(this.internalScrollGraceTimer);
		}
		this.internalScrollGraceTimer = null;
		this.internalScrollGraceWindow = null;
	}

	private runInternalScroll(
		target: HTMLElement | Window | null,
		scroll: () => void,
	): void {
		const previousPosition = target
			? isHTMLElementLike(target)
				? target.scrollTop
				: target.scrollY
			: null;
		this.internalScrollDepth += 1;
		try {
			scroll();
		} finally {
			this.internalScrollDepth -= 1;
			if (target) {
				const nextPosition = isHTMLElementLike(target)
					? target.scrollTop
					: target.scrollY;
				this.internalScrollPositions.set(target, nextPosition);
				if (nextPosition !== previousPosition) {
					// Virtual rows and native scroll anchoring may adjust the position after
					// the programmatic scroll event, once the new rows have been committed.
					this.clearInternalScrollGrace();
					const ownerWindow = this.rootEl?.ownerDocument.defaultView;
					if (ownerWindow) {
						this.internalScrollGraceWindow = ownerWindow;
						this.internalScrollGraceTimer = ownerWindow.setTimeout(() => {
							this.internalScrollGraceTimer = null;
							this.internalScrollGraceWindow = null;
						}, 300);
					}
				}
			}
		}
	}

	public moveRow(delta: -1 | 1): void {
		if (!this.rootEl || (this.selectedRowIndex < 0 && this.pendingLayoutTask)) {
			return;
		}

		this.cancelPendingLayoutTask();
		if (!this.refreshRows(true)) {
			this.deactivate();
			return;
		}

		const targetIndex = this.selectedRowIndex + delta;
		if (targetIndex >= 0 && targetIndex < this.rows.length) {
			this.selectRow(targetIndex);
			return;
		}

		// The first row has no previous card; do not scroll the editor on ArrowUp.
		if (delta > 0) this.scrollToAdjacentRow(delta);
	}

	public activateCardByHint(key: string): void {
		if (!this.rootEl || this.selectedRowIndex < 0) {
			return;
		}

		const normalizedKey = key.toLowerCase();
		const selectedRow = this.rows[this.selectedRowIndex];
		if (!selectedRow) {
			return;
		}

		const hintKeys = this.getHintKeysForRow(selectedRow.elements.length);
		const elementIndex = hintKeys.indexOf(normalizedKey);
		if (elementIndex < 0) {
			return;
		}

		const targetElement = selectedRow.elements[elementIndex];
		if (!targetElement) {
			return;
		}

		if (this.isLoadMoreButton(targetElement)) {
			this.activateLoadMoreByHint(targetElement, this.selectedRowIndex);
			return;
		}

		this.deactivate();
		targetElement.dispatchEvent(
			createOwnerMouseEvent(targetElement, "click", {
				bubbles: true,
				cancelable: true,
				composed: true,
			}),
		);
	}

	private handleDocumentKeydown(event: KeyboardEvent): void {
		if (!this.rootEl) {
			return;
		}

		if (!this.rootEl.isConnected || !isElementVisible(this.rootEl)) {
			this.deactivate();
			return;
		}

		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (this.isEditableTarget(event.target)) return;

		const key = event.key.toLowerCase();
		if (
			key !== "arrowup" &&
			key !== "arrowdown" &&
			key !== "escape" &&
			!HANDLED_HINT_KEYS.has(key)
		) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation?.();

		if (key === "arrowup") this.moveRow(-1);
		else if (key === "arrowdown") this.moveRow(1);
		else if (key === "escape") this.deactivate();
		else this.activateCardByHint(key);
	}

	private refreshRows(preserveSelection: boolean): boolean {
		if (!this.rootEl) {
			return false;
		}

		const previousSelectedItemIds =
			preserveSelection && this.selectedRowIndex >= 0
				? new Set(this.selectedItemIds)
				: new Set<string>();

		this.rows = collectVisibleKeyboardNavigationRows(this.rootEl);
		if (this.rows.length === 0) {
			this.selectedRowIndex = -1;
			this.selectedItemIds.clear();
			this.clearSelectionState();
			return false;
		}

		if (!preserveSelection) {
			this.selectRow(0);
			return true;
		}

		const preservedIndex = this.rows.findIndex((row) =>
			row.elements.some((element) => {
				const itemId = getResultTargetIdentity(element);
				return itemId !== null && previousSelectedItemIds.has(itemId);
			}),
		);
		const nextIndex =
			preservedIndex >= 0
				? preservedIndex
				: this.selectedRowIndex >= 0
					? Math.min(this.selectedRowIndex, this.rows.length - 1)
					: 0;
		// Refreshing a selection must not pull a boundary row back to the center.
		this.selectRow(nextIndex, false);
		return true;
	}

	private startAtFirstResult(): boolean {
		const rootEl = this.rootEl;
		const gridEl = rootEl && findKeyboardNavigationStart(rootEl);
		if (!gridEl || !rootEl) return false;

		const target = this.resolveScrollTarget();
		const scrollContainer = isHTMLElementLike(target) ? target : null;
		const metrics = getScrollMetrics(gridEl, scrollContainer);
		const nextTop = Math.max(0, metrics.sectionTop);
		if (target && nextTop !== metrics.scrollTop) {
			this.runInternalScroll(target, () => {
				if (isHTMLElementLike(target)) {
					target.scrollTop = nextTop;
				} else {
					target.scrollTo({ top: nextTop });
				}
				target.dispatchEvent(this.createOwnerEvent(target, "scroll"));
			});
		}

		const ownerWindow = getOptionalOwnerWindow(rootEl);
		if (!ownerWindow) return false;
		const awaitMountedRows = (remainingAttempts: number): void => {
			this.pendingLayoutTask = scheduleAfterAnimationFrames(
				ownerWindow,
				2,
				() => {
					this.pendingLayoutTask = null;
					if (this.rootEl !== rootEl) return;
					if (this.refreshRows(false)) return;
					if (remainingAttempts > 1 && findKeyboardNavigationStart(rootEl)) {
						awaitMountedRows(remainingAttempts - 1);
						return;
					}
					this.notify(
						getMainUiTranslations(this.getLanguage()).noVisibleCards,
					);
					this.deactivate();
				},
			);
		};
		awaitMountedRows(15);
		return true;
	}

	private collectRowItemIds(row: KeyboardNavigationRow | undefined): Set<string> {
		const itemIds = new Set<string>();
		for (const element of row?.elements ?? []) {
			const itemId = getResultTargetIdentity(element);
			if (itemId !== null) itemIds.add(itemId);
		}
		return itemIds;
	}

	private selectRow(index: number, center = true): void {
		if (!this.rootEl || this.rows.length === 0) {
			this.selectedRowIndex = -1;
			this.selectedItemIds.clear();
			return;
		}

		const clampedIndex = Math.max(0, Math.min(index, this.rows.length - 1));
		const row = this.rows[clampedIndex];
		const sameElements =
			row.elements.length === this.selectedElements.length &&
			row.elements.every(
				(element, elementIndex) =>
					element === this.selectedElements[elementIndex],
			);
		this.selectedRowIndex = clampedIndex;
		this.selectedItemIds = this.collectRowItemIds(row);
		if (sameElements) {
			if (center) this.centerRow(row);
			return;
		}

		this.clearSelectionState();
		this.selectedElements = [...row.elements];
		if (center) this.centerRow(row);
		for (const element of row.elements) {
			element.dataset.cclKbRowSelected = "1";
		}
		const hintKeys = this.getHintKeysForRow(row.elements.length);
		for (const [elementIndex, element] of row.elements.entries()) {
			const hintKey = hintKeys[elementIndex];
			if (hintKey) {
				element.dataset.cclKbHint = hintKey;
			}
		}
	}

	private clearSelectionState(): void {
		this.selectedElements = [];
		if (!this.rootEl) {
			return;
		}

		for (const card of querySelectorAllIncludingShadow<HTMLElement>(
			this.rootEl,
			"[data-ccl-kb-row-selected], [data-ccl-kb-hint]",
		)) {
			delete card.dataset.cclKbRowSelected;
			delete card.dataset.cclKbHint;
		}
	}

	private scrollToAdjacentRow(delta: -1 | 1): void {
		if (!this.rootEl || this.selectedRowIndex < 0) {
			return;
		}

		this.cancelPendingLayoutTask();

		const currentRow = this.rows[this.selectedRowIndex];
		if (!currentRow) {
			return;
		}

		const scrollContainer = this.resolveScrollTarget();
		if (!isHTMLElementLike(scrollContainer)) {
			return;
		}

		const scrollStep = estimateKeyboardNavigationScrollStep(
			this.rows,
			this.selectedRowIndex,
			delta,
		);
		const anchorTop = currentRow.top;
		this.runInternalScroll(scrollContainer, () =>
			scrollKeyboardNavigationContainerBy(
				scrollContainer,
				delta * scrollStep,
				this.createOwnerEvent.bind(this),
			),
		);

		const ownerWindow = getOptionalOwnerWindow(this.rootEl);
		if (!ownerWindow) {
			return;
		}

		this.pendingLayoutTask = scheduleAfterAnimationFrames(ownerWindow, 2, () => {
			this.pendingLayoutTask = null;

			if (!this.rootEl) {
				return;
			}

			this.rows = collectVisibleKeyboardNavigationRows(this.rootEl);
			if (this.rows.length === 0) {
				this.deactivate();
				return;
			}

			const nextIndex =
				delta > 0
					? this.rows.findIndex(
							(row) =>
								row.top > anchorTop + KEYBOARD_ROW_TOP_TOLERANCE_PX / 2,
						)
					: this.findLastIndex(
							this.rows,
							(row) =>
								row.top < anchorTop - KEYBOARD_ROW_TOP_TOLERANCE_PX / 2,
						);

			if (nextIndex >= 0) {
				this.selectRow(nextIndex);
				return;
			}

			// No adjacent row was revealed; leave the boundary row where it scrolled.
			this.selectRow(delta > 0 ? this.rows.length - 1 : 0, false);
		});
	}

	private centerRow(row: KeyboardNavigationRow): void {
		const target = this.resolveScrollTarget();
		this.runInternalScroll(target, () =>
			centerKeyboardNavigationRow(row, target, this.createOwnerEvent.bind(this)),
		);
	}

	private resolveScrollTarget(): HTMLElement | Window | null {
		const resolved = resolveKeyboardNavigationScrollTarget(
			this.rootEl,
			this.cachedScrollContainer,
		);
		this.cachedScrollContainer = resolved.cachedContainer;
		return resolved.target;
	}

	private activateLoadMoreByHint(
		loadMoreButton: HTMLButtonElement,
		rowIndex: number,
	): void {
		this.cancelPendingLayoutTask();

		const ownerWindow = getOptionalOwnerWindow(loadMoreButton);
		const rootEl = this.rootEl;
		if (!ownerWindow || !rootEl) return;
		const previousRowElements = this.rows[rowIndex]?.elements ?? [];

		const observer = new MutationObserver(() => scheduleRefresh());
		this.pendingLoadMoreObserver = observer;
		observer.observe(rootEl, { childList: true, subtree: true });
		// Mutations inside a shadow root do not reach its host.
		const renderRoot = loadMoreButton.getRootNode();
		if (renderRoot !== rootEl && renderRoot !== rootEl.ownerDocument) {
			observer.observe(renderRoot, { childList: true, subtree: true });
		}

		const refreshLoadedRows = (): void => {
			if (this.pendingLoadMoreObserver !== observer || !this.rootEl) return;
			const rows = collectVisibleKeyboardNavigationRows(this.rootEl);
			const nextRow = rows[rowIndex];
			// The old button can persist through several render/layout frames.
			if (
				!nextRow?.elements.some(
					(element) =>
						!this.isLoadMoreButton(element) &&
						!previousRowElements.includes(element),
				)
			) {
				return;
			}
			this.cancelPendingLayoutTask();
			this.rows = rows;
			this.selectRow(rowIndex);
		};
		const scheduleRefresh = (): void => {
			this.pendingLayoutTask?.cancel();
			this.pendingLayoutTask = scheduleAfterAnimationFrames(
				ownerWindow,
				1,
				() => {
					this.pendingLayoutTask = null;
					refreshLoadedRows();
				},
			);
		};

		loadMoreButton.click();
		scheduleRefresh();
	}

	private cancelPendingLayoutTask(): void {
		this.pendingLayoutTask?.cancel();
		this.pendingLayoutTask = null;
		this.pendingLoadMoreObserver?.disconnect();
		this.pendingLoadMoreObserver = null;
	}

	private getHintKeysForRow(targetCount: number): string[] {
		const start = Math.max(
			0,
			Math.ceil((LONG_HINT_KEYS.length - Math.max(targetCount, 2)) / 2),
		);
		return LONG_HINT_KEYS.slice(start, start + targetCount);
	}

	private isLoadMoreButton(element: HTMLElement): element is HTMLButtonElement {
		return element.matches(LOAD_MORE_SELECTOR);
	}

	private isEditableTarget(target: EventTarget | null): boolean {
		if (!isHTMLElementLike(target)) {
			return false;
		}

		const tagName = target.tagName.toUpperCase();
		return (
			tagName === "INPUT" ||
			tagName === "TEXTAREA" ||
			tagName === "SELECT" ||
			target.isContentEditable
		);
	}

	private createOwnerEvent(target: Node | Window, type: string): Event {
		const ownerWindow = (
			"document" in target ? target : getOptionalOwnerWindow(target)
		) as WindowWithEventConstructor | null;
		return ownerWindow ? new ownerWindow.Event(type) : new Event(type);
	}

	private findLastIndex<T>(items: T[], predicate: (value: T) => boolean): number {
		return findLastKeyboardNavigationRowIndex(items, predicate);
	}
}
