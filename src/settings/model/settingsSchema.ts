import { QUICK_SORT_FIELDS, SORT_OPTIONS } from "cards/sorting/types";
import { DEFAULT_SETTINGS } from "./defaults";
import {
	DISPLAY_MODES,
	LANGUAGES,
	MOBILE_LONG_PRESS_ACTIONS,
	SETTINGS_SCHEMA_VERSION,
	TWO_HOP_HEADER_SORT_ORDERS,
	type ConfigSettings,
	type PersistedPluginData,
	type PluginSettings,
} from "./settings";

type UnknownSettings = Readonly<Record<string, unknown>>;

/**
 * Validates the current storage envelope into runtime settings. Data from a
 * different schema version is intentionally reset instead of migrated.
 */
export function parsePluginSettings(raw: unknown): PluginSettings {
	if (!isCurrentPersistedPluginData(raw)) {
		return { ...DEFAULT_SETTINGS };
	}

	const settings = raw.settings;
	const preferences = raw.preferences;

	return {
		language: enumSetting(settings.language, LANGUAGES, DEFAULT_SETTINGS.language),
		displayMode: enumSetting(
			settings.displayMode,
			DISPLAY_MODES,
			DEFAULT_SETTINGS.displayMode,
		),
		useMergedLinksSection: booleanSetting(
			settings.useMergedLinksSection,
			DEFAULT_SETTINGS.useMergedLinksSection,
		),
		dedupeCards: booleanSetting(settings.dedupeCards, DEFAULT_SETTINGS.dedupeCards),
		enableTagFeatures: booleanSetting(
			settings.enableTagFeatures,
			DEFAULT_SETTINGS.enableTagFeatures,
		),
		showTagsSection: booleanSetting(
			settings.showTagsSection,
			DEFAULT_SETTINGS.showTagsSection,
		),
		defaultVisibleLinkCount: positiveIntegerSetting(
			settings.defaultVisibleLinkCount,
			DEFAULT_SETTINGS.defaultVisibleLinkCount,
		),
		loadMoreLinkIncrement: positiveIntegerSetting(
			settings.loadMoreLinkIncrement,
			DEFAULT_SETTINGS.loadMoreLinkIncrement,
		),
		cardWidthPx: positiveIntegerSetting(
			settings.cardWidthPx,
			DEFAULT_SETTINGS.cardWidthPx,
		),
		cardHeightRatio: positiveNumberSetting(
			settings.cardHeightRatio,
			DEFAULT_SETTINGS.cardHeightRatio,
		),
		cardGapPx: nonNegativeIntegerSetting(
			settings.cardGapPx,
			DEFAULT_SETTINGS.cardGapPx,
		),
		cardMaxColumns: positiveIntegerSetting(
			settings.cardMaxColumns,
			DEFAULT_SETTINGS.cardMaxColumns,
		),
		sectionMarginBottomPx: positiveIntegerSetting(
			settings.sectionMarginBottomPx,
			DEFAULT_SETTINGS.sectionMarginBottomPx,
		),
		highlightOnOpen: booleanSetting(
			settings.highlightOnOpen,
			DEFAULT_SETTINGS.highlightOnOpen,
		),
		highlightInPreviewOnHover: booleanSetting(
			settings.highlightInPreviewOnHover,
			DEFAULT_SETTINGS.highlightInPreviewOnHover,
		),
		twoHopHeaderSortOrder: enumSetting(
			settings.twoHopHeaderSortOrder,
			TWO_HOP_HEADER_SORT_ORDERS,
			DEFAULT_SETTINGS.twoHopHeaderSortOrder,
		),
		lastUsedSortOption: enumSetting(
			preferences.lastUsedSortOption,
			SORT_OPTIONS,
			DEFAULT_SETTINGS.lastUsedSortOption,
		),
		quickSortField1: enumSetting(
			settings.quickSortField1,
			QUICK_SORT_FIELDS,
			DEFAULT_SETTINGS.quickSortField1,
		),
		quickSortField2: enumSetting(
			settings.quickSortField2,
			QUICK_SORT_FIELDS,
			DEFAULT_SETTINGS.quickSortField2,
		),
		previewMaxLines: nonNegativeIntegerSetting(
			settings.previewMaxLines,
			DEFAULT_SETTINGS.previewMaxLines,
		),
		previewMaxChars: nonNegativeIntegerSetting(
			settings.previewMaxChars,
			DEFAULT_SETTINGS.previewMaxChars,
		),
		previewVisualLineSafetyMargin: nonNegativeIntegerSetting(
			settings.previewVisualLineSafetyMargin,
			DEFAULT_SETTINGS.previewVisualLineSafetyMargin,
		),
		showTwoHopForSelectedCanvasFileNode: booleanSetting(
			settings.showTwoHopForSelectedCanvasFileNode,
			DEFAULT_SETTINGS.showTwoHopForSelectedCanvasFileNode,
		),
		mobileLongPressAction: enumSetting(
			settings.mobileLongPressAction,
			MOBILE_LONG_PRESS_ACTIONS,
			DEFAULT_SETTINGS.mobileLongPressAction,
		),
		excludeAttachments: booleanSetting(
			settings.excludeAttachments,
			DEFAULT_SETTINGS.excludeAttachments,
		),
		frontmatterKeyCreatedDate: stringSetting(
			settings.frontmatterKeyCreatedDate,
			DEFAULT_SETTINGS.frontmatterKeyCreatedDate,
		),
		frontmatterKeyModifiedDate: stringSetting(
			settings.frontmatterKeyModifiedDate,
			DEFAULT_SETTINGS.frontmatterKeyModifiedDate,
		),
		enableGlobalSearchTagModal: booleanSetting(
			settings.enableGlobalSearchTagModal,
			DEFAULT_SETTINGS.enableGlobalSearchTagModal,
		),
		enableUnresolvedLinkModal: booleanSetting(
			settings.enableUnresolvedLinkModal,
			DEFAULT_SETTINGS.enableUnresolvedLinkModal,
		),
		enableEmptyViewAllNotesInNewTab: booleanSetting(
			settings.enableEmptyViewAllNotesInNewTab,
			DEFAULT_SETTINGS.enableEmptyViewAllNotesInNewTab,
		),
		pinBookmarkedToTopInAllNotes: booleanSetting(
			settings.pinBookmarkedToTopInAllNotes,
			DEFAULT_SETTINGS.pinBookmarkedToTopInAllNotes,
		),
		enableUnresolvedLinkDecoration: booleanSetting(
			settings.enableUnresolvedLinkDecoration,
			DEFAULT_SETTINGS.enableUnresolvedLinkDecoration,
		),
		enableContentSearch: booleanSetting(
			preferences.enableContentSearch,
			DEFAULT_SETTINGS.enableContentSearch,
		),
		experimentalCosenseTitleEditing: booleanSetting(
			settings.experimentalCosenseTitleEditing,
			DEFAULT_SETTINGS.experimentalCosenseTitleEditing,
		),
		experimentalShadowDomCss: stringSetting(
			settings.experimentalShadowDomCss,
			DEFAULT_SETTINGS.experimentalShadowDomCss,
		),
		priorityFrontmatterKeyForPreview: stringSetting(
			settings.priorityFrontmatterKeyForPreview,
			DEFAULT_SETTINGS.priorityFrontmatterKeyForPreview,
		),
		priorityFrontmatterKeyForTitle: stringSetting(
			settings.priorityFrontmatterKeyForTitle,
			DEFAULT_SETTINGS.priorityFrontmatterKeyForTitle,
		),
	};
}

export function isCurrentPersistedPluginData(raw: unknown): raw is Readonly<{
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	settings: UnknownSettings;
	preferences: UnknownSettings;
}> {
	return (
		isUnknownSettings(raw) &&
		raw.schemaVersion === SETTINGS_SCHEMA_VERSION &&
		isUnknownSettings(raw.settings) &&
		isUnknownSettings(raw.preferences)
	);
}

/** Converts runtime settings into the versioned storage envelope. */
export function serializePluginSettings(settings: PluginSettings): PersistedPluginData {
	const { lastUsedSortOption, enableContentSearch, ...configuration } = settings;

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		settings: { ...configuration } satisfies ConfigSettings,
		preferences: {
			lastUsedSortOption,
			enableContentSearch,
		},
	};
}

function isUnknownSettings(value: unknown): value is UnknownSettings {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enumSetting<const Values extends readonly unknown[]>(
	value: unknown,
	values: Values,
	fallback: Values[number],
): Values[number] {
	if (values.some((candidate) => Object.is(candidate, value))) {
		return value as Values[number];
	}
	return fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function stringSetting(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function positiveIntegerSetting(value: unknown, fallback: number): number {
	return isFiniteNumber(value) && value > 0 ? Math.floor(value) : fallback;
}

function nonNegativeIntegerSetting(value: unknown, fallback: number): number {
	return isFiniteNumber(value) && value >= 0 ? Math.floor(value) : fallback;
}

function positiveNumberSetting(value: unknown, fallback: number): number {
	return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}
