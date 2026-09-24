import { describe, expect, it } from "vitest";
import { collectSettingImpacts } from "../settingImpacts";

describe("setting impacts", () => {
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
});
