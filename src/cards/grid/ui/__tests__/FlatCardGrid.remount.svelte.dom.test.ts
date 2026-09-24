import { render, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import {
	createItems,
	getFlatCardGridElements,
	setFlatCardGridViewport,
	setupFlatCardGridTestEnvironment,
} from "./flatCardGridTestEnvironment";
import { flushFrames } from "testing/helpers/DOMObserverMock";
import FlatCardGridRenderProbeHarness from "./FlatCardGridRenderProbeHarness.svelte";

setupFlatCardGridTestEnvironment();

function getFirstSlotProbe(container: HTMLElement): HTMLElement | null {
	const gridRoot = container.querySelector<HTMLElement>(".ccl-virtual-grid");
	return (
		gridRoot?.shadowRoot?.querySelector<HTMLElement>(
			"[data-ccl-cell-slot='0'] [data-testid='probe-item-cell']",
		) ?? null
	);
}

describe("FlatCardGrid physical-slot body lifecycle", () => {
	it("remounts a physical-slot body when the item binding topology changes", async () => {
		const mountedItems: string[] = [];
		const items = createItems(2);
		const onItemMount = (id: string) => mountedItems.push(id);
		const rendered = render(FlatCardGridRenderProbeHarness, {
			props: {
				items,
				initialVisibleCount: 2,
				onItemMount,
			},
		});

		await setFlatCardGridViewport(getFlatCardGridElements(rendered.container), {
			rootHeight: 120,
			width: 330,
		});
		await waitFor(() => {
			expect(getFirstSlotProbe(rendered.container)?.textContent).toBe("Item 0");
		});
		const firstSlotProbeBefore = getFirstSlotProbe(rendered.container);
		expect(firstSlotProbeBefore).not.toBeNull();

		mountedItems.length = 0;
		await rendered.rerender({
			items: [items[1]!],
			initialVisibleCount: 2,
			onItemMount,
		});
		await flushFrames();

		await waitFor(() => {
			expect(getFirstSlotProbe(rendered.container)?.textContent).toBe("Item 1");
		});
		const firstSlotProbeAfter = getFirstSlotProbe(rendered.container);
		expect(firstSlotProbeAfter).not.toBe(firstSlotProbeBefore);
		expect(mountedItems).toContain("0-Item 1");
	});
});
