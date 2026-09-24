import { createTwoHopRowModel } from "../rowModel";
import {
	createTwoHopSectionModel,
	type TwoHopItemModel,
} from "two-hop/ui/twoHopSectionModel";

/** Creates the fixed-layout row model shared by mounted-row tests. */
export function createMountedRowsModel(
	itemCount: number,
): ReturnType<typeof createTwoHopRowModel> {
	const items = Array.from({ length: itemCount }, (_, index) => ({
		item: { type: "newLink" },
		searchKey: `item:${index}`,
		key: `item:${index}`,
	})) as TwoHopItemModel[];
	return createTwoHopRowModel({
		sections: [
			createTwoHopSectionModel({
				id: "section",
				kind: "new-links-section",
				title: "Section",
				items,
				totalCount: itemCount,
			}),
		],
		layout: {
			containerWidth: 320,
			columns: 3,
			cellWidth: 100,
			rowHeight: 100,
			gap: 10,
			sectionMarginBottom: 10,
		},
	});
}
