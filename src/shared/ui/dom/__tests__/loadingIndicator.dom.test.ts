import { describe, expect, it } from "vitest";
import { createLoadingIndicator } from "../loadingIndicator";

type DomOptions = {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
};

type DomHelpers = {
	createDiv: (options?: DomOptions) => HTMLDivElement;
	createEl: (tag: string, options?: DomOptions) => HTMLElement;
};

function applyDomHelpers<T extends HTMLElement>(el: T): T {
	const helpers = el as T & DomHelpers;

	helpers.createEl = (tag: string, options?: DomOptions): HTMLElement => {
		const child = applyDomHelpers(document.createElement(tag));
		if (options?.cls) {
			child.className = options.cls;
		}
		if (options?.text) {
			child.textContent = options.text;
		}
		if (options?.attr) {
			for (const [key, value] of Object.entries(options.attr)) {
				child.setAttribute(key, value);
			}
		}
		el.appendChild(child);
		return child;
	};

	helpers.createDiv = (options?: DomOptions): HTMLDivElement => {
		const child = helpers.createEl("div", options);
		return child as HTMLDivElement;
	};

	return el;
}

describe("createLoadingIndicator", () => {
	it("renders an accessible busy status with three bouncing dots", () => {
		const host = applyDomHelpers(document.createElement("div"));
		const indicator = createLoadingIndicator(host, "Loading...");

		expect(indicator.className).toBe("ccl-loading-container");
		expect(indicator.getAttribute("role")).toBe("status");
		expect(indicator.getAttribute("aria-live")).toBe("polite");
		expect(indicator.getAttribute("aria-busy")).toBe("true");

		const loader = indicator.querySelector(".ccl-loading-loader");
		expect(loader?.getAttribute("aria-hidden")).toBe("true");
		expect(indicator.querySelectorAll(".ccl-loading-dot")).toHaveLength(3);
		expect(indicator.querySelector(".ccl-loading-message")?.textContent).toBe(
			"Loading...",
		);
	});

	it("omits the message element when no message is provided", () => {
		const host = applyDomHelpers(document.createElement("div"));
		const indicator = createLoadingIndicator(host);

		expect(indicator.querySelector(".ccl-loading-message")).toBeNull();
		expect(indicator.querySelectorAll(".ccl-loading-dot")).toHaveLength(3);
	});
});
