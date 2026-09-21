import { displayTooltip, setTooltip } from "obsidian";
import { VIRTUAL_CELL_WILL_REBIND_EVENT } from "cards/interactions/virtualCellRebind";
import { findMatchingElementInComposedPath } from "shared/ui/dom/shadowDom";
import { isNodeLike } from "shared/ui/dom/realmSafeDom";

const TOOLTIP_SELECTOR = "[data-ccl-tooltip]";
const TOOLTIP_DELAY_MS = 1000;

interface TooltipProxyState {
	target: HTMLElement | null;
	proxy: HTMLDivElement | null;
	observer: MutationObserver | null;
}

function resolveTooltipTarget(
	shadowRoot: ShadowRoot,
	event: Event,
): HTMLElement | null {
	const target = findMatchingElementInComposedPath(event, TOOLTIP_SELECTOR);
	return target && shadowRoot.contains(target) ? target : null;
}

function isWithinTarget(target: HTMLElement, eventTarget: EventTarget | null): boolean {
	return (
		isNodeLike(eventTarget) &&
		(eventTarget === target || target.contains(eventTarget))
	);
}

function dispatchProxyPointerOut(proxy: HTMLElement): void {
	const windowRef = proxy.ownerDocument.defaultView;
	const MouseEventConstructor = windowRef?.MouseEvent;
	if (!MouseEventConstructor) return;

	proxy.dispatchEvent(
		new MouseEventConstructor("pointerout", {
			bubbles: true,
			composed: true,
			relatedTarget: proxy.ownerDocument.body,
		}),
	);
}

function createTooltipProxy(target: HTMLElement, text: string): HTMLDivElement {
	const documentRef = target.ownerDocument;
	const rect = target.getBoundingClientRect();
	const proxy = documentRef.createElement("div");
	proxy.dataset.cclTooltipProxy = "1";
	proxy.style.position = "fixed";
	proxy.style.left = `${rect.left}px`;
	proxy.style.top = `${rect.top}px`;
	proxy.style.width = `${rect.width}px`;
	proxy.style.height = `${rect.height}px`;
	proxy.style.pointerEvents = "none";
	proxy.setAttribute("aria-hidden", "true");
	documentRef.body.append(proxy);
	setTooltip(proxy, text, {
		placement: "top",
		delay: TOOLTIP_DELAY_MS,
	});
	return proxy;
}

/** Bridges Shadow DOM card hover events to Obsidian's native tooltip lifecycle. */
export function installShadowTooltipBridge(shadowRoot: ShadowRoot): () => void {
	const documentRef = shadowRoot.ownerDocument;
	const windowRef = documentRef.defaultView;
	const state: TooltipProxyState = {
		target: null,
		proxy: null,
		observer: null,
	};

	function hide(): void {
		state.observer?.disconnect();
		state.observer = null;
		if (state.proxy) {
			dispatchProxyPointerOut(state.proxy);
			state.proxy.remove();
		}
		state.proxy = null;
		state.target = null;
	}

	function show(target: HTMLElement): void {
		const text = target.dataset.cclTooltip?.trim();
		if (!text) return;

		hide();
		const interactionHandle = target.dataset.cclInteractionHandle;
		const proxy = createTooltipProxy(target, text);
		state.target = target;
		state.proxy = proxy;
		if (windowRef) {
			state.observer = new windowRef.MutationObserver(() => {
				if (
					!target.isConnected ||
					!shadowRoot.contains(target) ||
					target.dataset.cclTooltip?.trim() !== text ||
					target.dataset.cclInteractionHandle !== interactionHandle
				) {
					hide();
				}
			});
			state.observer.observe(shadowRoot, {
				attributes: true,
				attributeFilter: ["data-ccl-interaction-handle", "data-ccl-tooltip"],
				childList: true,
				subtree: true,
			});
		}
		displayTooltip(proxy, text, {
			placement: "top",
			delay: TOOLTIP_DELAY_MS,
		});
	}

	const onPointerOver: EventListener = (event) => {
		const target = resolveTooltipTarget(shadowRoot, event);
		if (!target || isWithinTarget(target, (event as PointerEvent).relatedTarget)) {
			return;
		}
		if (state.target === target) return;
		show(target);
	};
	const onPointerOut: EventListener = (event) => {
		if (!state.target) return;
		const target = resolveTooltipTarget(shadowRoot, event);
		if (target !== state.target) return;
		if (isWithinTarget(state.target, (event as PointerEvent).relatedTarget)) return;
		hide();
	};

	shadowRoot.addEventListener("pointerover", onPointerOver);
	shadowRoot.addEventListener("pointerout", onPointerOut);
	shadowRoot.addEventListener(VIRTUAL_CELL_WILL_REBIND_EVENT, hide);
	documentRef.addEventListener("scroll", hide, true);
	windowRef?.addEventListener("resize", hide);

	return () => {
		shadowRoot.removeEventListener("pointerover", onPointerOver);
		shadowRoot.removeEventListener("pointerout", onPointerOut);
		shadowRoot.removeEventListener(VIRTUAL_CELL_WILL_REBIND_EVENT, hide);
		documentRef.removeEventListener("scroll", hide, true);
		windowRef?.removeEventListener("resize", hide);
		hide();
	};
}
