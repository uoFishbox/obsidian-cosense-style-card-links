import { describe, expect, it } from "vitest";
import {
	loadPluginSettings,
	parsePluginSettings,
	serializePluginSettings,
} from "settings/model/settingsSchema";
import { DEFAULT_SETTINGS } from "settings/model/defaults";
import {
	SETTINGS_SCHEMA_VERSION,
	type ConfigSettings,
	type UserPreferences,
} from "settings/model/settings";

function persistedData(
	settings: Partial<ConfigSettings> = {},
	preferences: Partial<UserPreferences> = {},
): unknown {
	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		settings,
		preferences,
	};
}

describe("settings schema", () => {
	it("ignores removed Canvas and mobile long-press settings in saved data", () => {
		const settings = parsePluginSettings(
			persistedData({
				showTwoHopForSelectedCanvasFileNode: false,
				mobileLongPressAction: "preview",
			} as Partial<ConfigSettings>),
		);
		const serialized = serializePluginSettings(settings);

		expect(settings).not.toHaveProperty("showTwoHopForSelectedCanvasFileNode");
		expect(settings).not.toHaveProperty("mobileLongPressAction");
		expect(serialized.settings).not.toHaveProperty(
			"showTwoHopForSelectedCanvasFileNode",
		);
		expect(serialized.settings).not.toHaveProperty("mobileLongPressAction");
	});

	it.each(["relevance", "relevance-reverse"] as const)(
		"restores the %s sort preference",
		(sortOption) => {
			expect(
				parsePluginSettings(
					persistedData({}, { lastUsedSortOption: sortOption }),
				).lastUsedSortOption,
			).toBe(sortOption);
		},
	);

	it.each([undefined, null, "true", 1, false])(
		"keeps experimental title editing disabled for %s",
		(value) => {
			expect(
				parsePluginSettings(
					persistedData({ experimentalCosenseTitleEditing: value as never }),
				).experimentalCosenseTitleEditing,
			).toBe(false);
		},
	);

	it("loads and saves the preview scroll speed with a default for existing data", () => {
		expect(parsePluginSettings(persistedData()).previewScrollCommitsPerSecond).toBe(
			DEFAULT_SETTINGS.previewScrollCommitsPerSecond,
		);
		const settings = parsePluginSettings(
			persistedData({ previewScrollCommitsPerSecond: 170 }),
		);
		expect(settings.previewScrollCommitsPerSecond).toBe(170);
		expect(
			serializePluginSettings(settings).settings.previewScrollCommitsPerSecond,
		).toBe(170);
	});

	it.each([0, 23, 40.8, Number.NaN, "96"])(
		"rejects invalid preview scroll speed %s",
		(value) => {
			expect(
				parsePluginSettings(
					persistedData({ previewScrollCommitsPerSecond: value as number }),
				).previewScrollCommitsPerSecond,
			).toBe(DEFAULT_SETTINGS.previewScrollCommitsPerSecond);
		},
	);

	it("clamps a previously saved scroll speed above the new maximum", () => {
		expect(
			parsePluginSettings(persistedData({ previewScrollCommitsPerSecond: 192 }))
				.previewScrollCommitsPerSecond,
		).toBe(170);
	});

	it("preserves valid experimental values", () => {
		const css = ".card { color: rebeccapurple; }";
		const settings = parsePluginSettings(
			persistedData({
				experimentalCosenseTitleEditing: true,
				experimentalShadowDomCss: css,
			}),
		);

		expect(settings.experimentalCosenseTitleEditing).toBe(true);
		expect(settings.experimentalShadowDomCss).toBe(css);
	});

	it("accepts a fully valid storage envelope unchanged", () => {
		const runtimeSettings = { ...DEFAULT_SETTINGS, language: "ja" as const };

		expect(parsePluginSettings(serializePluginSettings(runtimeSettings))).toEqual(
			runtimeSettings,
		);
	});

	it("falls back per field for invalid current-version data", () => {
		const settings = parsePluginSettings(
			persistedData(
				{
					language: "fr" as never,
					displayMode: "floating" as never,
					dedupeCards: "yes" as never,
					frontmatterKeyCreatedDate: 123 as never,
					quickSortField1: "unknown-field" as never,
					quickSortField2: 2 as never,
				},
				{ lastUsedSortOption: "unknown-sort" as never },
			),
		);

		expect(settings.language).toBe(DEFAULT_SETTINGS.language);
		expect(settings.displayMode).toBe(DEFAULT_SETTINGS.displayMode);
		expect(settings.dedupeCards).toBe(DEFAULT_SETTINGS.dedupeCards);
		expect(settings.frontmatterKeyCreatedDate).toBe(
			DEFAULT_SETTINGS.frontmatterKeyCreatedDate,
		);
		expect(settings.lastUsedSortOption).toBe(DEFAULT_SETTINGS.lastUsedSortOption);
		expect(settings.quickSortField1).toBe(DEFAULT_SETTINGS.quickSortField1);
		expect(settings.quickSortField2).toBe(DEFAULT_SETTINGS.quickSortField2);
	});

	it("normalizes numeric settings", () => {
		const settings = parsePluginSettings(
			persistedData({
				cardWidthPx: 140.9,
				cardGapPx: 0,
				cardHeightRatio: 0,
				cardMaxColumns: Number.POSITIVE_INFINITY,
				previewMaxChars: "500" as never,
			}),
		);

		expect(settings.cardWidthPx).toBe(140);
		expect(settings.cardGapPx).toBe(0);
		expect(settings.cardHeightRatio).toBe(DEFAULT_SETTINGS.cardHeightRatio);
		expect(settings.cardMaxColumns).toBe(DEFAULT_SETTINGS.cardMaxColumns);
		expect(settings.previewMaxChars).toBe(DEFAULT_SETTINGS.previewMaxChars);
	});

	it("strips unknown keys from current-version data", () => {
		const settings = parsePluginSettings({
			schemaVersion: SETTINGS_SCHEMA_VERSION,
			settings: {
				...DEFAULT_SETTINGS,
				obsoleteSetting: { retained: false },
				previewActivationAheadRows: 2,
			},
			preferences: {},
		});

		expect(settings).not.toHaveProperty("obsoleteSetting");
		expect(settings).not.toHaveProperty("previewActivationAheadRows");
	});

	it("migrates schema version 1 through versions 2 and 3", () => {
		const result = loadPluginSettings({
			...DEFAULT_SETTINGS,
			settingsSchemaVersion: 1,
			language: "ja",
			highlightOnOpen: "never",
			lastUsedSortOption: "modified-date",
			enableContentSearch: true,
		});

		expect(result.status).toBe("migrated");
		if (result.status !== "migrated") return;
		expect(result.fromVersion).toBe(1);
		expect(result.settings.language).toBe("ja");
		expect(result.settings.highlightOnOpen).toBe(false);
		expect(result.settings.lastUsedSortOption).toBe("modified-date");
		expect(result.settings.enableContentSearch).toBe(true);
	});

	it("migrates schema version 2 into the current envelope", () => {
		const result = loadPluginSettings({
			...DEFAULT_SETTINGS,
			settingsSchemaVersion: 2,
			language: "ja",
			lastUsedSortOption: "created-date",
			enableContentSearch: true,
		});

		expect(result.status).toBe("migrated");
		if (result.status !== "migrated") return;
		expect(result.fromVersion).toBe(2);
		expect(result.settings.language).toBe("ja");
		expect(result.settings.lastUsedSortOption).toBe("created-date");
		expect(result.settings.enableContentSearch).toBe(true);
	});

	it("does not interpret unversioned or unsupported data as current", () => {
		expect(parsePluginSettings({ ...DEFAULT_SETTINGS, language: "ja" })).toEqual(
			DEFAULT_SETTINGS,
		);

		const result = loadPluginSettings({
			schemaVersion: SETTINGS_SCHEMA_VERSION + 1,
			settings: { language: "ja" },
			preferences: {},
		});
		expect(result.status).toBe("unsupported-schema");
		expect(result.settings).toEqual(DEFAULT_SETTINGS);
	});

	it("returns full defaults for malformed envelopes", () => {
		expect(parsePluginSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parsePluginSettings("corrupted")).toEqual(DEFAULT_SETTINGS);
		expect(parsePluginSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
	});

	it("serializes configuration and preferences separately", () => {
		const serialized = serializePluginSettings({
			...DEFAULT_SETTINGS,
			language: "ja",
			lastUsedSortOption: "modified-date",
			enableContentSearch: true,
		});

		expect(serialized.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
		expect(serialized.settings.language).toBe("ja");
		expect(serialized.settings).not.toHaveProperty("lastUsedSortOption");
		expect(serialized.settings).not.toHaveProperty("enableContentSearch");
		expect(serialized.preferences).toEqual({
			lastUsedSortOption: "modified-date",
			enableContentSearch: true,
		});
	});
});
