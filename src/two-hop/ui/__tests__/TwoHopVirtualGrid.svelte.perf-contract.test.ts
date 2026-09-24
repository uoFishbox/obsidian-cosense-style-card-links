import { cleanup } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTwoHopSectionModel } from "two-hop/ui/twoHopSectionModel";
import {
	flushFrames,
	installAnimationFrameMock,
	installResizeObserverMock,
	resetRecords,
	setNumericProperty,
	teardownAnimationFrameMock,
	teardownResizeObserverMock,
} from "testing/helpers/DOMObserverMock";
import type { VirtualFrameLane } from "shared/ui/scheduling/frameCoordinator";
import {
	createCardModelResolver,
	createSection,
	renderSurface,
} from "./twoHopVirtualGridFixture";

const cardDemandProbe = vi.hoisted(() => ({
	getPreviewVisibleRangeCalls: 0,
	rangeEffectRuns: 0,
}));

vi.mock("two-hop/ui/virtual-grid/twoHopCardRuntime", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("two-hop/ui/virtual-grid/twoHopCardRuntime")
		>();
	return {
		...actual,
		createTwoHopCardRuntime: (
			options: Parameters<typeof actual.createTwoHopCardRuntime>[0],
		) => {
			const frameCoordinator = {
				...options.frameCoordinator,
				schedule(
					lane: VirtualFrameLane,
					key: string,
					task: () => void,
				): boolean {
					return options.frameCoordinator.schedule(lane, key, () => {
						const callsBefore = cardDemandProbe.getPreviewVisibleRangeCalls;
						task();
						if (cardDemandProbe.getPreviewVisibleRangeCalls > callsBefore) {
							cardDemandProbe.rangeEffectRuns += 1;
						}
					});
				},
			};
			return actual.createTwoHopCardRuntime({
				...options,
				frameCoordinator,
				getPreviewVisibleRange: () => {
					cardDemandProbe.getPreviewVisibleRangeCalls += 1;
					return options.getPreviewVisibleRange();
				},
			});
		},
	};
});

beforeEach(() => {
	resetRecords();
	cardDemandProbe.getPreviewVisibleRangeCalls = 0;
	cardDemandProbe.rangeEffectRuns = 0;
	installResizeObserverMock();
	installAnimationFrameMock();
	setNumericProperty(window, "scrollY", 0);
});

afterEach(() => {
	cleanup();
	teardownAnimationFrameMock();
	teardownResizeObserverMock();
});

describe("TwoHopVirtualGrid performance contract", () => {
	it("publishes card demand once for one section publication", async () => {
		const resolver = createCardModelResolver();
		const section = createSection(20);
		const { publishSection } = await renderSurface({
			section,
			resolveItemCardModel: resolver,
		});
		cardDemandProbe.getPreviewVisibleRangeCalls = 0;
		cardDemandProbe.rangeEffectRuns = 0;

		const replacement = { ...section.items[0]! };
		await publishSection(
			createTwoHopSectionModel({
				id: section.id,
				kind: section.kind,
				title: section.title,
				items: [replacement, ...section.items.slice(1)],
				totalCount: section.totalCount,
			}),
		);
		const demandAfterRerender = cardDemandProbe.rangeEffectRuns;
		for (let index = 0; index < 4; index += 1) await flushFrames();

		expect(demandAfterRerender).toBe(0);
		expect(cardDemandProbe.rangeEffectRuns).toBe(1);
	});
});
