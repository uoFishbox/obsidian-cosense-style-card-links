import { describe, expect, it, vi } from "vitest";
import { tick } from "svelte";
import { createFlatGridScrollRestorationController } from "../scrollRestoration";

describe("flat-grid scroll restoration", () => {
	it("retains a captured position across an empty result commit", async () => {
		const scroller = document.createElement("div");
		scroller.style.overflow = "auto";
		Object.defineProperty(scroller, "clientHeight", {
			configurable: true,
			value: 300,
		});
		Object.defineProperty(scroller, "scrollHeight", {
			configurable: true,
			value: 2_000,
		});
		let scrollTop = 900;
		Object.defineProperty(scroller, "scrollTop", {
			configurable: true,
			get: () => scrollTop,
			set: (value: number) => {
				scrollTop = value;
			},
		});
		let rootEl: HTMLElement | null = scroller.appendChild(
			document.createElement("div"),
		);
		const suppressNextNativeScroll = vi.fn();
		const runDataChangeMeasurement = vi.fn();
		const controller = createFlatGridScrollRestorationController({
			getRootEl: () => rootEl,
			getScrollContainerEl: () => scroller,
			suppressNextNativeScroll,
			runDataChangeMeasurement,
		});

		controller.preserveScrollPosition();
		rootEl.remove();
		rootEl = null;
		scrollTop = 200;
		controller.scheduleAfterSnapshot();
		await tick();

		expect(scrollTop).toBe(200);
		expect(runDataChangeMeasurement).not.toHaveBeenCalled();

		rootEl = scroller.appendChild(document.createElement("div"));
		controller.scheduleAfterSnapshot();
		await tick();

		expect(scrollTop).toBe(900);
		expect(suppressNextNativeScroll).toHaveBeenCalledWith(900);
		expect(runDataChangeMeasurement).toHaveBeenCalledOnce();
	});
});
