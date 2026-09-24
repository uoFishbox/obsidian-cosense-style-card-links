import { describe, expect, it } from "vitest";
import { createResidentRowSlotAllocator } from "cards/virtualization/public";
import { buildMountedTwoHopRows } from "../mountedRows";
import { createMountedRowsModel } from "./mountedRowsModelFixture";

describe("buildMountedTwoHopRows", () => {
	it("bounds resident rows and cells independently of total item count", () => {
		for (const itemCount of [100, 1_000, 10_000]) {
			const model = createMountedRowsModel(itemCount);
			const allocator = createResidentRowSlotAllocator();
			const build = buildMountedTwoHopRows({
				rowModel: model,
				rowRange: { start: 10, end: 19 },
				rowSlotAllocator: allocator,
			});
			const cells = build.rowsInMountedRange.flatMap((row) =>
				row.bindings.filter((cell) => cell !== null),
			);

			expect(build.rowsInMountedRange).toHaveLength(9);
			expect(cells).toHaveLength(27);
			expect(new Set(cells.map((cell) => cell.physicalCellSlot)).size).toBe(27);
			allocator.dispose();
		}
	});
});
