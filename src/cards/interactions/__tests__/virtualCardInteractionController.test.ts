import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import type { CardItem } from "cards/CardItem";
import { createVirtualCardInteractionController } from "../virtualCardInteractionController";
import type { VirtualCardInteractionController } from "../virtualCardInteractionController";
import type { ItemInteractionDescriptor } from "../interactionTypes";

interface TestBinding {
	readonly key: string;
	readonly physicalCellSlot: number;
	readonly descriptor: ItemInteractionDescriptor | null;
}

function syncCards(
	controller: VirtualCardInteractionController,
	bindings: readonly {
		readonly slotId: number;
		readonly key?: string;
		readonly descriptor: ItemInteractionDescriptor | null;
	}[],
): boolean {
	const cells: TestBinding[] = bindings.map(({ slotId, key, descriptor }) => ({
		key: key ?? descriptor?.targetFile?.path ?? "notes/card.md",
		physicalCellSlot: slotId,
		descriptor,
	}));
	return controller.syncMountedRows([{ bindings: cells }], (cell) => cell.descriptor);
}

function createDescriptor(path: string): ItemInteractionDescriptor {
	const file = { path, extension: "md" } as TFile;
	return {
		kind: "item",
		item: { type: "file", data: file } as CardItem,
		targetFile: file,
	};
}

describe("virtualCardInteractionController", () => {
	it("invalidates an old handle when a slot changes cards before descriptors hydrate", () => {
		const controller = createVirtualCardInteractionController();
		const descriptor = createDescriptor("notes/card.md");
		syncCards(controller, [{ slotId: 0, key: "section-a/card", descriptor }]);
		const oldHandle = controller.getInteractionHandle(0);
		syncCards(controller, [{ slotId: 0, key: "section-a/card", descriptor: null }]);
		expect(controller.getInteractionHandle(0)).toBe(oldHandle);

		expect(
			syncCards(controller, [
				{ slotId: 0, key: "section-b/card", descriptor: null },
			]),
		).toBe(true);
		const nextHandle = controller.getInteractionHandle(0);
		expect(nextHandle).not.toBe(oldHandle);
		syncCards(controller, [{ slotId: 0, key: "section-b/card", descriptor }]);
		expect(controller.getInteractionHandle(0)).toBe(nextHandle);
		expect(controller.resolveInteractionDescriptor(oldHandle)).toBeNull();
		expect(controller.resolveInteractionDescriptor(nextHandle)).toBe(descriptor);
	});

	it("keeps a mounted binding when its descriptor is refreshed", () => {
		const controller = createVirtualCardInteractionController();
		syncCards(controller, [
			{
				slotId: 0,
				key: "card",
				descriptor: createDescriptor("notes/card.md"),
			},
		]);
		const handle = controller.getInteractionHandle(0);
		const refreshed = createDescriptor("notes/renamed-card.md");
		expect(
			syncCards(controller, [{ slotId: 0, key: "card", descriptor: refreshed }]),
		).toBe(false);
		expect(controller.getInteractionHandle(0)).toBe(handle);
		expect(controller.resolveInteractionDescriptor(handle)).toBe(refreshed);
	});

	it("invalidates hydrated and empty handles on clear and creates fresh bindings", () => {
		const controller = createVirtualCardInteractionController();
		const descriptor = createDescriptor("notes/card.md");
		expect(
			syncCards(controller, [
				{ slotId: 0, descriptor },
				{ slotId: 1, descriptor: null },
			]),
		).toBe(true);
		const hydratedHandle = controller.getInteractionHandle(0);
		const emptyHandle = controller.getInteractionHandle(1);

		controller.clear();
		controller.clear();
		expect(syncCards(controller, [])).toBe(false);
		syncCards(controller, [
			{ slotId: 0, descriptor },
			{ slotId: 1, descriptor },
		]);

		for (const [slotId, oldHandle] of [
			[0, hydratedHandle],
			[1, emptyHandle],
		] as const) {
			expect(controller.resolveInteractionDescriptor(oldHandle)).toBeNull();
			const handle = controller.getInteractionHandle(slotId);
			expect(handle).not.toBe(oldHandle);
			expect(controller.resolveInteractionDescriptor(handle)).toBe(descriptor);
		}
	});

	it("allocates a stable handle before a slot descriptor is hydrated", () => {
		const controller = createVirtualCardInteractionController();
		const descriptor = createDescriptor("notes/card.md");
		const handle = controller.getInteractionHandle(0);

		expect(controller.resolveInteractionDescriptor(handle)).toBeNull();
		expect(syncCards(controller, [{ slotId: 0, descriptor }])).toBe(false);

		expect(controller.getInteractionHandle(0)).toBe(handle);
		expect(controller.resolveInteractionDescriptor(handle)).toBe(descriptor);
	});

	it("rotates the handle when a physical slot is rebound to another semantic item", () => {
		const controller = createVirtualCardInteractionController();
		const first = createDescriptor("notes/first-card.md");
		const second = createDescriptor("notes/second-card.md");

		syncCards(controller, [{ slotId: 0, descriptor: first }]);
		const firstHandle = controller.getInteractionHandle(0);
		expect(syncCards(controller, [{ slotId: 0, descriptor: second }])).toBe(true);
		const secondHandle = controller.getInteractionHandle(0);

		expect(secondHandle).not.toBe(firstHandle);
		expect(controller.resolveInteractionDescriptor(firstHandle)).toBeNull();
		expect(controller.resolveInteractionDescriptor(secondHandle)).toBe(second);
	});

	it("retains the handle when refreshed data represents the same semantic item", () => {
		const controller = createVirtualCardInteractionController();
		const first = createDescriptor("notes/first-version.md");
		const refreshed = createDescriptor("notes/refreshed-version.md");

		syncCards(controller, [{ slotId: 0, key: "card", descriptor: first }]);
		const handle = controller.getInteractionHandle(0);
		expect(
			syncCards(controller, [{ slotId: 0, key: "card", descriptor: refreshed }]),
		).toBe(false);

		expect(controller.getInteractionHandle(0)).toBe(handle);
		expect(controller.resolveInteractionDescriptor(handle)).toBe(refreshed);
	});

	it("drops a handle when its slot leaves the mounted window", () => {
		const controller = createVirtualCardInteractionController();
		const descriptor = createDescriptor("notes/card.md");
		syncCards(controller, [{ slotId: 0, descriptor }]);
		const handle = controller.getInteractionHandle(0);

		expect(syncCards(controller, [])).toBe(true);

		expect(controller.resolveInteractionDescriptor(handle)).toBeNull();
	});

	it("gives slots with the same semantic interaction independent handles", () => {
		const controller = createVirtualCardInteractionController();
		const first = createDescriptor("notes/first-card.md");
		const second = createDescriptor("notes/second-card.md");

		syncCards(controller, [
			{ slotId: 0, key: "shared-card", descriptor: first },
			{ slotId: 1, key: "shared-card", descriptor: second },
		]);
		const firstHandle = controller.getInteractionHandle(0);
		const secondHandle = controller.getInteractionHandle(1);

		expect(firstHandle).not.toBe(secondHandle);
		expect(controller.resolveInteractionDescriptor(firstHandle)).toBe(first);
		expect(controller.resolveInteractionDescriptor(secondHandle)).toBe(second);

		syncCards(controller, [{ slotId: 1, key: "shared-card", descriptor: second }]);
		expect(controller.resolveInteractionDescriptor(firstHandle)).toBeNull();
		expect(controller.resolveInteractionDescriptor(secondHandle)).toBe(second);
	});

	it("keeps the handle for a mounted slot while its descriptor is unavailable", () => {
		const controller = createVirtualCardInteractionController();
		const descriptor = createDescriptor("notes/card.md");
		syncCards(controller, [{ slotId: 0, descriptor }]);
		const handle = controller.getInteractionHandle(0);

		expect(syncCards(controller, [{ slotId: 0, descriptor: null }])).toBe(false);

		expect(controller.getInteractionHandle(0)).toBe(handle);
		expect(controller.resolveInteractionDescriptor(handle)).toBeNull();

		syncCards(controller, [{ slotId: 0, descriptor }]);
		expect(controller.getInteractionHandle(0)).toBe(handle);
		expect(controller.resolveInteractionDescriptor(handle)).toBe(descriptor);
	});
});
