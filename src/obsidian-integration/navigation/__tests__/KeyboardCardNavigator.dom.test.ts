import { describe, expect, it, vi, beforeEach } from "vitest";
import { KeyboardCardNavigator } from "../KeyboardCardNavigator";
import { MarkdownView } from "obsidian";
import { nextAnimationFrame } from "shared/ui/scheduling/frame";
import {
	collectVisibleKeyboardNavigationRows,
	createKeyboardNavigationSurfaceRegistry,
} from "../keyboardNavigationSurface";

vi.mock("obsidian", () => {
	class MarkdownView {
		containerEl: HTMLElement;

		constructor() {
			this.containerEl = document.createElement("div");
		}
	}

	class ItemView {
		containerEl: HTMLElement;

		constructor() {
			this.containerEl = document.createElement("div");
		}
	}

	return {
		ItemView,
		MarkdownView,
		Notice: vi.fn(),
	};
});

vi.mock("two-hop/ui/TwoHopLinksView", () => ({
	TWO_HOP_LINKS_VIEW_TYPE: "cosense-card-links-view",
}));

type RectInit = {
	top: number;
	left: number;
	width?: number;
	height?: number;
};

function setVisibleRect(
	element: HTMLElement,
	{ top, left, width = 120, height = 48 }: RectInit,
): void {
	const rect = {
		top,
		left,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({}),
	} satisfies DOMRect;

	Object.defineProperty(element, "getBoundingClientRect", {
		configurable: true,
		value: () => rect,
	});
	Object.defineProperty(element, "getClientRects", {
		configurable: true,
		value: () =>
			({
				length: 1,
				item: () => rect,
				[Symbol.iterator]: function* () {
					yield rect;
				},
			}) as DOMRectList,
	});
	Object.defineProperty(element, "clientHeight", {
		configurable: true,
		value: height,
	});
	Object.defineProperty(element, "clientWidth", {
		configurable: true,
		value: width,
	});
}

function createCard(id: string, rect: RectInit): HTMLElement {
	const card = document.createElement("div");
	card.className = "ccl-box";
	card.dataset.cclInteractionHandle = id;
	setVisibleRect(card, rect);
	return card;
}

function createLoadMoreButton(rect: RectInit): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "ccl-load-more-button ccl-box";
	button.setAttribute("aria-label", "Load more");
	setVisibleRect(button, rect);
	return button;
}

function createSurface(
	placement: "editor" | "sidebar" | "workspace",
	cards: HTMLElement[] = [],
): HTMLElement {
	const surface = document.createElement("div");
	surface.className = placement === "workspace" ? "ccl-empty-view" : "ccl-root";
	surface.dataset.cclCardSurface = placement;
	surface.tabIndex = -1;
	setVisibleRect(surface, { top: 0, left: 0, width: 600, height: 400 });
	for (const card of cards) {
		surface.append(card);
	}
	return surface;
}

function createWorkspace(options: {
	activeView?: MarkdownView | null;
	sidebarContainers?: HTMLElement[];
	emptyViewContainers?: HTMLElement[];
}) {
	const registry = createKeyboardNavigationSurfaceRegistry();
	const editorSurface = options.activeView?.containerEl.querySelector<HTMLElement>(
		'[data-ccl-card-surface="editor"]',
	);
	if (editorSurface) {
		registry.register(editorSurface);
	}
	for (const container of options.sidebarContainers ?? []) {
		const surface = container.querySelector<HTMLElement>(
			'[data-ccl-card-surface="sidebar"]',
		);
		if (surface) registry.register(surface);
	}
	for (const container of options.emptyViewContainers ?? []) {
		const surface = container.querySelector<HTMLElement>(
			'[data-ccl-card-surface="workspace"]',
		);
		if (surface) registry.register(surface);
	}
	return registry;
}

function dispatchKey(key: string, options?: { target?: HTMLElement }) {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});
	if (options?.target) {
		Object.defineProperty(event, "target", {
			value: options.target,
		});
	}
	document.dispatchEvent(event);
}

function getSelectedCard(root: HTMLElement): HTMLElement | null {
	return root.querySelector<HTMLElement>("[data-ccl-kb-row-selected]");
}

function getHintForElement(
	root: HTMLElement,
	interactionId: string,
): string | undefined {
	const el = root.querySelector<HTMLElement>(
		`[data-ccl-interaction-handle="${interactionId}"]`,
	);
	return el?.dataset.cclKbHint;
}

function hasAnyHints(root: HTMLElement): boolean {
	return root.querySelector<HTMLElement>("[data-ccl-kb-hint]") !== null;
}

describe("KeyboardCardNavigator", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	describe("surface resolution", () => {
		it("prefers the active markdown editor surface over the sidebar surface", () => {
			const inlineCard = createCard("inline-card", {
				top: 10,
				left: 20,
			});
			const inlineSurface = createSurface("editor", [inlineCard]);
			const sidebarCard = createCard("sidebar-card", {
				top: 10,
				left: 20,
			});
			const sidebarSurface = createSurface("sidebar", [sidebarCard]);
			const activeView = new MarkdownView({} as never);
			activeView.containerEl.append(inlineSurface);
			document.body.append(activeView.containerEl);

			const sidebarContainer = document.createElement("div");
			sidebarContainer.append(sidebarSurface);
			document.body.append(sidebarContainer);

			const workspace = createWorkspace({
				activeView,
				sidebarContainers: [sidebarContainer],
			});
			const navigator = new KeyboardCardNavigator(workspace, vi.fn());

			expect(workspace.findBestVisibleSurface()).toBe(inlineSurface);
		});

		it("falls back to sidebar when active editor surface has no cards", () => {
			const activeView = new MarkdownView({} as never);
			const emptyInlineSurface = createSurface("editor", []);
			activeView.containerEl.append(emptyInlineSurface);
			document.body.append(activeView.containerEl);
			const sidebarCard = createCard("sidebar-card", {
				top: 10,
				left: 20,
			});
			const sidebarSurface = createSurface("sidebar", [sidebarCard]);
			const sidebarContainer = document.createElement("div");
			sidebarContainer.append(sidebarSurface);
			document.body.append(sidebarContainer);
			const workspace = createWorkspace({
				activeView,
				sidebarContainers: [sidebarContainer],
			});
			const navigator = new KeyboardCardNavigator(workspace, vi.fn());

			expect(workspace.findBestVisibleSurface()).toBe(sidebarSurface);
		});

		it("falls back to sidebar when inline surface has only non-navigable elements", () => {
			const activeView = new MarkdownView({} as never);
			const inlineSurface = createSurface("editor");
			const nonCard = document.createElement("div");
			nonCard.className = "some-other-class";
			inlineSurface.append(nonCard);
			activeView.containerEl.append(inlineSurface);
			document.body.append(activeView.containerEl);

			const sidebarCard = createCard("sidebar-card", {
				top: 10,
				left: 20,
			});
			const sidebarSurface = createSurface("sidebar", [sidebarCard]);
			const sidebarContainer = document.createElement("div");
			sidebarContainer.append(sidebarSurface);
			document.body.append(sidebarContainer);

			const workspace = createWorkspace({
				activeView,
				sidebarContainers: [sidebarContainer],
			});
			const navigator = new KeyboardCardNavigator(workspace, vi.fn());

			expect(workspace.findBestVisibleSurface()).toBe(sidebarSurface);
		});

		it("prefers an active workspace surface over a non-preferred editor surface", () => {
			const editorSurface = createSurface("editor", [
				createCard("editor-card", { top: 10, left: 20 }),
			]);
			const workspaceSurface = createSurface("workspace", [
				createCard("workspace-card", { top: 10, left: 20 }),
			]);
			document.body.append(editorSurface, workspaceSurface);
			const registry = createKeyboardNavigationSurfaceRegistry();
			const activeLeaf = document.createElement("div");
			activeLeaf.className = "workspace-leaf mod-active";
			activeLeaf.append(workspaceSurface);
			document.body.append(activeLeaf);
			registry.register(editorSurface);
			registry.register(workspaceSurface);

			expect(registry.findBestVisibleSurface()).toBe(workspaceSurface);
		});

		it("selects an active surface with logical results but no mounted cards", () => {
			const editorSurface = createSurface("editor");
			const grid = document.createElement("div");
			grid.dataset.cclNavigationResults = "";
			editorSurface.append(grid);
			const sidebarSurface = createSurface("sidebar", [
				createCard("sidebar-card", { top: 10, left: 20 }),
			]);
			const activeLeaf = document.createElement("div");
			activeLeaf.className = "workspace-leaf mod-active";
			activeLeaf.append(editorSurface);
			document.body.append(activeLeaf, sidebarSurface);
			const registry = createKeyboardNavigationSurfaceRegistry();
			registry.register(editorSurface);
			registry.register(sidebarSurface);

			expect(registry.findBestVisibleSurface()).toBe(editorSurface);
			delete grid.dataset.cclNavigationResults;
			expect(registry.findBestVisibleSurface()).toBe(sidebarSurface);
		});

		it("removes a surface when its registration cleanup runs", () => {
			const surface = createSurface("editor", [
				createCard("editor-card", { top: 10, left: 20 }),
			]);
			document.body.append(surface);
			const registry = createKeyboardNavigationSurfaceRegistry();
			const unregister = registry.register(surface);

			unregister();

			expect(registry.findBestVisibleSurface()).toBeNull();
		});
	});

	describe("row collection", () => {
		it("groups visible cards into rows by top position and sorts each row left-to-right", () => {
			const root = createSurface("editor", [
				createCard("row-1-b", { top: 12, left: 240 }),
				createCard("row-2-a", { top: 92, left: 20 }),
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-b", { top: 95, left: 210 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			const rows = collectVisibleKeyboardNavigationRows(root);

			expect(rows).toHaveLength(2);
			expect(
				rows[0].elements.map((card) => card.dataset.cclInteractionHandle),
			).toEqual(["row-1-a", "row-1-b"]);
			expect(
				rows[1].elements.map((card) => card.dataset.cclInteractionHandle),
			).toEqual(["row-2-a", "row-2-b"]);
		});

		it("collects visible rows from cards rendered inside shadow roots", () => {
			const root = createSurface("editor");
			const shadowRoot = root.attachShadow({ mode: "open" });
			shadowRoot.append(
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-1-b", { top: 12, left: 240 }),
				createCard("row-2-a", { top: 92, left: 20 }),
			);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			const rows = collectVisibleKeyboardNavigationRows(root);

			expect(rows).toHaveLength(2);
			expect(
				rows[0].elements.map((card) => card.dataset.cclInteractionHandle),
			).toEqual(["row-1-a", "row-1-b"]);
			expect(
				rows[1].elements.map((card) => card.dataset.cclInteractionHandle),
			).toEqual(["row-2-a"]);
		});
	});

	describe("keyboard navigation", () => {
		it("handles global keyboard mode before the CardGrid local keydown handler", () => {
			const firstCard = createCard("row-1-a", { top: 10, left: 20 });
			const root = createSurface("editor", [
				firstCard,
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			const localKeydown = vi.fn();
			root.addEventListener("keydown", localKeydown);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			firstCard.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "ArrowDown",
					bubbles: true,
					cancelable: true,
				}),
			);

			expect(localKeydown).not.toHaveBeenCalled();
			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-2-a");
		});

		it("selects the first row on activation and assigns hints to visible cards", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-1-b", { top: 10, left: 180 }),
				createCard("row-2-a", { top: 90, left: 20 }),
				createCard("row-2-b", { top: 90, left: 180 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-1-a");
			expect(hasAnyHints(root)).toBe(true);
		});

		it("moves selection down with ArrowDown", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			dispatchKey("ArrowDown");

			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-2-a");
		});

		it("moves selection up with ArrowUp", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			dispatchKey("ArrowDown");

			dispatchKey("ArrowUp");

			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-1-a");
		});

		it("preserves selection by interaction identity when physical cards are recycled", () => {
			const firstCard = createCard("row-1-a", { top: 10, left: 20 });
			const recycledCard = createCard("row-2-a", { top: 90, left: 20 });
			const root = createSurface("editor", [firstCard, recycledCard]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			dispatchKey("ArrowDown");

			const replacementCard = createCard("row-2-a", { top: 90, left: 20 });
			recycledCard.dataset.cclInteractionHandle = "row-3-a";
			setVisibleRect(recycledCard, { top: 170, left: 20 });
			root.append(replacementCard);

			dispatchKey("ArrowUp");

			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-1-a");
			expect(replacementCard.dataset.cclKbRowSelected).toBeUndefined();
			expect(recycledCard.dataset.cclKbRowSelected).toBeUndefined();
		});

		it("exits navigation mode on Escape", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			dispatchKey("Escape");

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(getSelectedCard(root)).toBeNull();
		});

		it("ignores arrow keys from editable elements", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			const input = document.createElement("input");
			root.append(input);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			dispatchKey("ArrowDown", { target: input });

			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-1-a");
		});

		it("ignores keys when modifiers are pressed", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			const event = new KeyboardEvent("keydown", {
				key: "ArrowDown",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});
			document.dispatchEvent(event);

			expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe("row-1-a");
		});
	});

	describe("hint-based activation", () => {
		it.each([
			[1, ["f"]],
			[2, ["f", "j"]],
			[3, ["f", "j", "k"]],
			[4, ["d", "f", "j", "k"]],
			[5, ["d", "f", "j", "k", "l"]],
			[6, ["s", "d", "f", "j", "k", "l"]],
			[7, ["s", "d", "f", "j", "k", "l", ";"]],
			[8, ["a", "s", "d", "f", "j", "k", "l", ";"]],
		])("assigns center-first hints to a row of %i cards", (count, hints) => {
			const cards = Array.from({ length: count }, (_, index) =>
				createCard(`card-${index}`, { top: 10, left: index * 60 }),
			);
			const root = createSurface("editor", cards);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);

			expect(cards.map((card) => card.dataset.cclKbHint)).toEqual(hints);
			navigator.deactivate();
		});

		it("activates the card matching its displayed hint", () => {
			const firstCard = createCard("first", { top: 10, left: 20 });
			const secondCard = createCard("second", { top: 10, left: 180 });
			const onClick = vi.fn();
			secondCard.addEventListener("click", onClick);
			const root = createSurface("editor", [firstCard, secondCard]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			dispatchKey("j");

			expect(onClick).toHaveBeenCalledOnce();
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
		});

		it("activates a card by its hint key", () => {
			const targetListener = vi.fn();
			const rowOneA = createCard("row-1-a", { top: 10, left: 20 });
			const rowOneB = createCard("row-1-b", { top: 10, left: 180 });
			rowOneB.addEventListener("click", targetListener);

			const root = createSurface("editor", [
				rowOneA,
				rowOneB,
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);
			const hintB = getHintForElement(root, "row-1-b");
			expect(hintB).toBeDefined();

			navigator.activateCardByHint(hintB!);

			expect(targetListener).toHaveBeenCalledTimes(1);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(getSelectedCard(root)).toBeNull();
		});

		it("does nothing for an invalid hint key", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			const initialSelected = getSelectedCard(root);

			navigator.activateCardByHint("z");

			expect(getSelectedCard(root)).toBe(initialSelected);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
		});

		it("activates load more button by hint and stays in keyboard mode", async () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, {
				top: 0,
				left: 0,
				width: 640,
				height: 140,
			});

			const firstRowCard = createCard("row-1-a", { top: 46, left: 20 });
			const loadMoreButton = createLoadMoreButton({ top: 126, left: 20 });
			const root = createSurface("editor", [firstRowCard, loadMoreButton]);
			scrollContainer.append(root);
			document.body.append(scrollContainer);

			const onExpand = vi.fn(() => {
				loadMoreButton.remove();
				root.append(createCard("row-2-a", { top: 126, left: 20 }));
			});
			loadMoreButton.addEventListener("click", onExpand);

			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);
			dispatchKey("ArrowDown");

			expect(getSelectedCard(root)).toBe(loadMoreButton);
			const loadMoreHint = loadMoreButton.dataset.cclKbHint;
			expect(loadMoreHint).toBeDefined();
			expect(onExpand).not.toHaveBeenCalled();

			navigator.activateCardByHint(loadMoreHint!);

			await vi.waitFor(() => {
				expect(onExpand).toHaveBeenCalledTimes(1);
			});
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
		});

		it("assigns hints to cards rendered after load more completes asynchronously in a shadow root", async () => {
			const root = createSurface("editor");
			const shadowRoot = root.attachShadow({ mode: "open" });
			const firstCard = createCard("row-1-a", { top: 10, left: 20 });
			const loadMoreButton = createLoadMoreButton({ top: 90, left: 20 });
			shadowRoot.append(firstCard, loadMoreButton);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			const nextCard = createCard("row-2-a", { top: 90, left: 20 });
			loadMoreButton.addEventListener("click", () => {
				setTimeout(() => {
					loadMoreButton.remove();
					shadowRoot.append(nextCard);
				}, 50);
			});

			navigator.activate(root);
			dispatchKey("ArrowDown");
			dispatchKey(loadMoreButton.dataset.cclKbHint!);

			await vi.waitFor(() => {
				expect(nextCard.dataset.cclKbHint).toBe("f");
			});
			expect(nextCard.dataset.cclKbRowSelected).toBe("1");
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			navigator.deactivate();
		});

		it("selects newly loaded cards even when a load more button remains", async () => {
			const firstCard = createCard("row-1-a", { top: 10, left: 20 });
			const loadMoreButton = createLoadMoreButton({ top: 90, left: 20 });
			const root = createSurface("editor", [firstCard, loadMoreButton]);
			document.body.append(root);
			const nextCard = createCard("row-2-a", { top: 90, left: 20 });
			loadMoreButton.addEventListener("click", () => {
				setTimeout(() => {
					setVisibleRect(loadMoreButton, { top: 170, left: 20 });
					root.insertBefore(nextCard, loadMoreButton);
				}, 50);
			});
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			dispatchKey("ArrowDown");

			dispatchKey(loadMoreButton.dataset.cclKbHint!);

			await vi.waitFor(() => {
				expect(nextCard.dataset.cclKbHint).toBe("f");
			});
			expect(loadMoreButton.dataset.cclKbHint).toBeUndefined();
			navigator.deactivate();
		});

		it("dispatches composed synthetic click from shadow-rendered card", () => {
			const root = createSurface("editor");
			const shadowRoot = root.attachShadow({ mode: "open" });

			const card = createCard("shadow-card", { top: 10, left: 20 });
			shadowRoot.append(card);

			const delegatedClick = vi.fn();
			root.addEventListener("click", delegatedClick);

			document.body.append(root);

			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);
			const hint = card.dataset.cclKbHint;
			expect(hint).toBeDefined();

			navigator.activateCardByHint(hint!);

			expect(delegatedClick).toHaveBeenCalledTimes(1);
		});
	});

	describe("scroll behavior", () => {
		it("scrolls to virtual results and selects a card mounted after scrolling", async () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, { top: 0, left: 0, height: 120 });
			const root = createSurface("editor");
			const grid = document.createElement("div");
			grid.dataset.cclNavigationResults = "";
			setVisibleRect(grid, { top: 600, left: 20, height: 200 });
			root.append(grid);
			scrollContainer.append(root);
			document.body.append(scrollContainer);
			const registry = createKeyboardNavigationSurfaceRegistry();
			registry.register(root);
			const navigator = new KeyboardCardNavigator(registry, vi.fn());
			scrollContainer.addEventListener("scroll", () => {
				if (scrollContainer.scrollTop === 600 && !grid.firstChild) {
					grid.append(createCard("first-result", { top: 0, left: 20 }));
				}
			});

			navigator.toggle();

			expect(scrollContainer.scrollTop).toBe(600);
			await vi.waitFor(() => {
				expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe(
					"first-result",
				);
			});
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			navigator.deactivate();
		});

		it("waits for virtual rows published after the scroll measurement", async () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, { top: 0, left: 0, height: 120 });
			const root = createSurface("editor");
			const grid = document.createElement("div");
			grid.dataset.cclNavigationResults = "";
			setVisibleRect(grid, { top: 600, left: 20, height: 200 });
			root.append(grid);
			scrollContainer.append(root);
			document.body.append(scrollContainer);
			const registry = createKeyboardNavigationSurfaceRegistry();
			registry.register(root);
			const navigator = new KeyboardCardNavigator(registry, vi.fn());

			navigator.toggle();
			await new Promise((resolve) => setTimeout(resolve, 180));
			scrollContainer.scrollTop = 605;
			scrollContainer.dispatchEvent(new Event("scroll"));
			grid.append(createCard("delayed-result", { top: 0, left: 20 }));

			await vi.waitFor(() => {
				expect(getSelectedCard(root)?.dataset.cclInteractionHandle).toBe(
					"delayed-result",
				);
			});
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			navigator.deactivate();
		});

		it("keeps navigation active through a native scroll correction after activation", async () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, { top: 0, left: 0, height: 100 });
			const root = createSurface("editor", [
				createCard("result", { top: 126, left: 20 }),
			]);
			scrollContainer.append(root);
			document.body.append(scrollContainer);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);
			expect(scrollContainer.scrollTop).toBe(100);
			scrollContainer.scrollTop = 95;
			scrollContainer.dispatchEvent(new Event("scroll"));
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);

			await new Promise((resolve) => setTimeout(resolve, 350));
			scrollContainer.scrollTop = 50;
			scrollContainer.dispatchEvent(new Event("scroll"));
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
		});

		it("does not select a late card after the mode is deactivated", async () => {
			const root = createSurface("editor");
			const grid = document.createElement("div");
			grid.dataset.cclNavigationResults = "";
			root.append(grid);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			navigator.deactivate();
			const card = createCard("late-result", { top: 10, left: 20 });
			grid.append(card);

			await nextAnimationFrame();
			await nextAnimationFrame();
			expect(card.dataset.cclKbHint).toBeUndefined();
		});

		it("keeps the scroll position and hints when ArrowUp repeats at the first row", async () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, { top: 0, left: 0, height: 100 });
			scrollContainer.scrollTop = 200;

			const card = createCard("first-row", { top: 26, left: 20 });
			Object.defineProperty(card, "getBoundingClientRect", {
				configurable: true,
				value: () => {
					const top = 26 + 200 - scrollContainer.scrollTop;
					return {
						top,
						bottom: top + 48,
						left: 20,
						right: 140,
						width: 120,
						height: 48,
					};
				},
			});
			const root = createSurface("editor", [card]);
			scrollContainer.append(root);
			document.body.append(scrollContainer);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			const changedAttributes: MutationRecord[] = [];
			const mutations = new MutationObserver((records) => {
				changedAttributes.push(...records);
			});
			mutations.observe(card, {
				attributes: true,
				attributeFilter: ["data-ccl-kb-row-selected", "data-ccl-kb-hint"],
			});
			for (let index = 0; index < 5; index++) {
				dispatchKey("ArrowUp");
				await nextAnimationFrame();
				await nextAnimationFrame();
				await nextAnimationFrame();
			}

			expect(scrollContainer.scrollTop).toBe(200);
			expect(card.dataset.cclKbRowSelected).toBe("1");
			expect(card.dataset.cclKbHint).toBe("f");
			expect(changedAttributes).toHaveLength(0);
			expect(mutations.takeRecords()).toHaveLength(0);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			mutations.disconnect();
			navigator.deactivate();
		});

		it("keeps the selected row centered in the nearest scroll container", () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, {
				top: 0,
				left: 0,
				width: 640,
				height: 100,
			});

			const root = createSurface("editor", [
				createCard("row-1-a", { top: 26, left: 20 }),
				createCard("row-2-a", { top: 126, left: 20 }),
			]);
			scrollContainer.append(root);
			document.body.append(scrollContainer);

			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());

			navigator.activate(root);
			expect(scrollContainer.scrollTop).toBe(0);

			navigator.moveRow(1);

			expect(scrollContainer.scrollTop).toBe(100);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			// Browsers can deliver the native scroll event after the synthetic one.
			scrollContainer.dispatchEvent(new Event("scroll"));
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
		});

		it("exits immediately on a wheel gesture over the card surface", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			root.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 40 }));

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(hasAnyHints(root)).toBe(false);
		});

		it("exits on scrolling the owner window", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			const scrollY = vi.spyOn(window, "scrollY", "get").mockReturnValue(40);
			window.dispatchEvent(new Event("scroll"));
			scrollY.mockRestore();

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
		});

		it("exits on external scrolling of an ancestor, but not an unrelated pane", () => {
			const scrollContainer = document.createElement("div");
			scrollContainer.style.overflowY = "auto";
			setVisibleRect(scrollContainer, { top: 0, left: 0, height: 100 });
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 26, left: 20 }),
			]);
			scrollContainer.append(root);
			const otherPane = document.createElement("div");
			document.body.append(scrollContainer, otherPane);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			otherPane.dispatchEvent(new Event("scroll"));
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);
			scrollContainer.scrollTop = 40;
			scrollContainer.dispatchEvent(new Event("scroll"));

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(getSelectedCard(root)).toBeNull();
		});
	});

	describe("deactivation", () => {
		it("cleans up selection state and class on deactivate", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
				createCard("row-2-a", { top: 90, left: 20 }),
			]);
			document.body.append(root);
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);

			navigator.deactivate();

			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(getSelectedCard(root)).toBeNull();
		});
	});
	describe("window migration", () => {
		it("rebinds the keydown listener to the migrated surface document", () => {
			const root = createSurface("editor", [
				createCard("row-1-a", { top: 10, left: 20 }),
			]);
			document.body.append(root);
			let migrate: ((ownerWindow: Window) => void) | undefined;
			const unregister = vi.fn();
			Object.defineProperty(root, "onWindowMigrated", {
				configurable: true,
				value: vi.fn((listener: (ownerWindow: Window) => void) => {
					migrate = listener;
					return unregister;
				}),
			});
			const navigator = new KeyboardCardNavigator(createWorkspace({}), vi.fn());
			navigator.activate(root);

			const frame = document.createElement("iframe");
			document.body.append(frame);
			const foreignDocument = frame.contentDocument;
			const foreignWindow = frame.contentWindow;
			expect(foreignDocument).toBeTruthy();
			expect(foreignWindow).toBeTruthy();
			if (!foreignDocument || !foreignWindow) return;

			foreignDocument.body.append(root);
			migrate?.(foreignWindow);

			const foreignEventWindow = foreignWindow as Window & {
				KeyboardEvent: typeof KeyboardEvent;
			};

			document.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(true);

			foreignDocument.dispatchEvent(
				new foreignEventWindow.KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
				}),
			);
			expect(root.classList.contains("ccl-kb-nav-active")).toBe(false);
			expect(unregister).toHaveBeenCalledOnce();
		});
	});
});
