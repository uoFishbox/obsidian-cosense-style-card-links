import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "settings/model";
import {
	MAX_PREVIEW_DOM_COMMITS_PER_SECOND,
	MIN_PREVIEW_DOM_COMMITS_PER_SECOND,
	PREVIEW_DOM_COMMITS_STEP,
} from "card-preview/scheduling/previewSchedulingConfig";
import { PREVIEW_SETTING_DEFINITIONS } from "../previewSettings";

describe("PREVIEW_SETTING_DEFINITIONS", () => {
	it("exposes a single slider for text and image scroll preview speeds", () => {
		const definition = PREVIEW_SETTING_DEFINITIONS.find(
			(candidate) => candidate.settingKey === "previewScrollCommitsPerSecond",
		);

		expect(definition?.controlType).toBe("slider");
		if (!definition || definition.controlType !== "slider") return;
		expect(definition.min).toBe(MIN_PREVIEW_DOM_COMMITS_PER_SECOND);
		expect(definition.max).toBe(MAX_PREVIEW_DOM_COMMITS_PER_SECOND);
		expect(definition.step).toBe(PREVIEW_DOM_COMMITS_STEP);
		expect((definition.max - definition.min) % definition.step).toBe(0);
	});

	it("defines a comma-separated image property setting", () => {
		const definition = PREVIEW_SETTING_DEFINITIONS.find(
			(candidate) =>
				candidate.settingKey === "priorityFrontmatterKeysForImagePreview",
		);

		expect(definition?.controlType).toBe("text");
		if (!definition || definition.controlType !== "text") return;

		expect(definition.parse(" image, cover ", DEFAULT_SETTINGS)).toBe(
			"image, cover",
		);
	});

	it("accepts zero as the card gap", () => {
		const definition = PREVIEW_SETTING_DEFINITIONS.find(
			(candidate) => candidate.settingKey === "cardGapPx",
		);

		expect(definition?.controlType).toBe("text");
		if (!definition || definition.controlType !== "text") return;

		expect(definition.parse("0", DEFAULT_SETTINGS)).toBe(0);
		expect(definition.parse("-1", DEFAULT_SETTINGS)).toBeUndefined();
		expect(definition.parse("12px", DEFAULT_SETTINGS)).toBeUndefined();
		expect(definition.parse("1.5", DEFAULT_SETTINGS)).toBeUndefined();
	});
});
