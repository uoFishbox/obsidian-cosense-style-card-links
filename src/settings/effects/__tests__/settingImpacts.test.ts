import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "settings/model";
import { SETTING_IMPACTS, collectSettingImpacts } from "../settingImpacts";

describe("setting impacts", () => {
	it("declares impacts for every runtime setting", () => {
		expect(Object.keys(SETTING_IMPACTS).sort()).toEqual(
			Object.keys(DEFAULT_SETTINGS).sort(),
		);
	});

	it("deduplicates impacts across a batch", () => {
		const impacts = collectSettingImpacts(["cardWidthPx", "cardHeightRatio"]);

		expect([...impacts]).toEqual([
			"invalidate-sort",
			"reactivate-display-mode",
			"refresh-card-views",
		]);
	});

	it("updates the scroll preview rate without refreshing card views", () => {
		expect([...collectSettingImpacts(["previewScrollCommitsPerSecond"])]).toEqual([]);
	});

	it("keeps view-local preferences free from global refresh work", () => {
		expect([...collectSettingImpacts(["lastUsedSortOption"])]).toEqual([]);
		expect([...collectSettingImpacts(["enableContentSearch"])]).toEqual([
			"invalidate-sort",
		]);
	});
});
