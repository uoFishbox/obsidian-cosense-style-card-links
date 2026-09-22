import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "settings/model";
import { DISPLAY_SETTING_DEFINITIONS } from "../displaySettings";
import { INTERACTION_SETTING_DEFINITIONS } from "../interactionSettings";
import { PREVIEW_SETTING_DEFINITIONS } from "../previewSettings";
import { SECTION_ORDER } from "../settingDefinition";

const SETTING_DEFINITIONS = [
	...DISPLAY_SETTING_DEFINITIONS,
	...PREVIEW_SETTING_DEFINITIONS,
	...INTERACTION_SETTING_DEFINITIONS,
];

describe("setting definitions", () => {
	it("orders the user-facing sections", () => {
		expect(SECTION_ORDER.map((section) => section.id)).toEqual([
			"general",
			"cards",
			"results",
			"interaction",
			"tags",
			"unresolvedLinks",
			"canvas",
			"newTab",
			"advanced",
		]);
	});

	it("defines every visible setting exactly once", () => {
		const settingKeys = SETTING_DEFINITIONS.map(
			(definition) => definition.settingKey,
		);

		expect(new Set(settingKeys).size).toBe(settingKeys.length);
	});

	it("assigns every definition to a rendered section", () => {
		const sectionIds = new Set(SECTION_ORDER.map((section) => section.id));

		for (const definition of SETTING_DEFINITIONS) {
			expect(sectionIds.has(definition.section)).toBe(true);
		}
	});

	it.each([
		["editor-inline", "displayModeEditorInlineDesc"],
		["sidebar-view", "displayModeSidebarDesc"],
		["hybrid", "displayModeHybridDesc"],
	] as const)(
		"changes the display mode description for %s",
		(displayMode, expectedDescriptionKey) => {
			const definition = DISPLAY_SETTING_DEFINITIONS.find(
				(candidate) => candidate.settingKey === "displayMode",
			);

			expect(definition).toBeDefined();
			if (!definition) return;

			expect(definition.refreshOnChange).toBe(true);
			expect(definition.descriptionKey).toBeTypeOf("function");
			if (typeof definition.descriptionKey !== "function") return;

			expect(
				definition.descriptionKey({ ...DEFAULT_SETTINGS, displayMode }),
			).toBe(expectedDescriptionKey);
		},
	);

	it("assigns former integration settings to independent sections", () => {
		const sectionBySetting = new Map(
			SETTING_DEFINITIONS.map((definition) => [
				definition.settingKey,
				definition.section,
			]),
		);

		expect(sectionBySetting.get("enableTagFeatures")).toBe("tags");
		expect(sectionBySetting.get("showTagsSection")).toBe("tags");
		expect(sectionBySetting.get("enableGlobalSearchTagModal")).toBe("tags");
		expect(sectionBySetting.get("enableUnresolvedLinkDecoration")).toBe(
			"unresolvedLinks",
		);
		expect(sectionBySetting.get("enableUnresolvedLinkModal")).toBe(
			"unresolvedLinks",
		);
		expect(sectionBySetting.get("showTwoHopForSelectedCanvasFileNode")).toBe(
			"canvas",
		);
		expect(sectionBySetting.get("enableEmptyViewAllNotesInNewTab")).toBe("newTab");
		expect(sectionBySetting.get("pinBookmarkedToTopInAllNotes")).toBe("newTab");
	});
});
