const DOT_COUNT = 3;

/**
 * Builds the shared bouncing-dot loading indicator for DOM-built views.
 *
 * Svelte surfaces use `shared/ui/primitives/LoadingState.svelte`, which renders
 * the same class names. Keep both in sync with the `--ccl-` styles in
 * `styles.css`.
 */
export function createLoadingIndicator(
	parentEl: HTMLElement,
	message?: string,
): HTMLDivElement {
	const containerEl = parentEl.createDiv({
		cls: "cosense-card-links__loading-container",
	});
	containerEl.setAttribute("role", "status");
	containerEl.setAttribute("aria-live", "polite");
	containerEl.setAttribute("aria-busy", "true");

	const loaderEl = containerEl.createDiv({
		cls: "cosense-card-links__loading-loader",
	});
	loaderEl.setAttribute("aria-hidden", "true");
	for (let dotIndex = 0; dotIndex < DOT_COUNT; dotIndex += 1) {
		loaderEl.createEl("span", { cls: "cosense-card-links__loading-dot" });
	}

	if (message) {
		containerEl.createEl("p", {
			cls: "cosense-card-links__loading-message",
			text: message,
		});
	}

	return containerEl;
}
