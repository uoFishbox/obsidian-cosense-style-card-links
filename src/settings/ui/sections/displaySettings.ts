import {
	defineDropdown,
	parsePositiveInteger,
	parseTrimmedString,
} from "./settingDefinition";
import type { SelectOption, SettingDefinition } from "./settingDefinition";
import type { QuickSortField } from "cards/sorting";
import type { DisplayMode } from "settings/model";
import type { TranslationKey } from "../translations";

const DISPLAY_MODE_DESCRIPTION_KEYS = {
	"editor-inline": "displayModeEditorInlineDesc",
	"sidebar-view": "displayModeSidebarDesc",
	hybrid: "displayModeHybridDesc",
} as const satisfies Record<DisplayMode, TranslationKey>;

const QUICK_SORT_OPTIONS: readonly SelectOption<QuickSortField>[] = [
	{ value: "none", label: "none", isTranslationKey: true },
	{ value: "relevance", label: "sortRelevance", isTranslationKey: true },
	{ value: "title", label: "sortTitle", isTranslationKey: true },
	{ value: "backlinks", label: "sortBacklinks", isTranslationKey: true },
	{ value: "created-date", label: "sortCreatedDate", isTranslationKey: true },
	{ value: "modified-date", label: "sortModifiedDate", isTranslationKey: true },
	{ value: "file-size", label: "sortFileSize", isTranslationKey: true },
];

export const DISPLAY_SETTING_DEFINITIONS: ReadonlyArray<SettingDefinition> = [
	defineDropdown({
		section: "general",
		settingKey: "language",
		translationKey: "language",
		descriptionKey: "languageDesc",
		options: [
			{ value: "en", label: "English" },
			{ value: "ja", label: "日本語" },
		],
	}),
	defineDropdown({
		section: "general",
		settingKey: "displayMode",
		translationKey: "displayMode",
		descriptionKey: (settings) =>
			DISPLAY_MODE_DESCRIPTION_KEYS[settings.displayMode],
		refreshOnChange: true,
		options: [
			{
				value: "editor-inline",
				label: "belowEditor",
				isTranslationKey: true,
			},
			{ value: "sidebar-view", label: "sidebar", isTranslationKey: true },
			{ value: "hybrid", label: "hybrid", isTranslationKey: true },
		],
	}),
	{
		section: "results",
		settingKey: "defaultVisiblePrimaryLinkCount",
		controlType: "text",
		translationKey: "defaultVisiblePrimaryLinkCount",
		descriptionKey: "defaultVisiblePrimaryLinkCountDesc",
		parse: (value) => parsePositiveInteger(value),
		format: (value) => String(value ?? ""),
	},
	{
		section: "results",
		settingKey: "defaultVisibleLinkCount",
		controlType: "text",
		translationKey: "defaultVisibleLinkCount",
		descriptionKey: "defaultVisibleLinkCountDesc",
		parse: (value) => parsePositiveInteger(value),
		format: (value) => String(value ?? ""),
	},
	{
		section: "results",
		settingKey: "loadMoreLinkIncrement",
		controlType: "text",
		translationKey: "loadMoreLinkIncrement",
		descriptionKey: "loadMoreLinkIncrementDesc",
		parse: (value) => parsePositiveInteger(value),
		format: (value) => String(value ?? ""),
	},
	{
		section: "cards",
		settingKey: "sectionMarginBottomPx",
		controlType: "text",
		translationKey: "sectionMarginBottom",
		descriptionKey: "sectionMarginBottomDesc",
		placeholder: "45",
		parse: (value) => parsePositiveInteger(value),
		format: (value) => String(value ?? ""),
	},
	{
		section: "results",
		settingKey: "useMergedLinksSection",
		controlType: "toggle",
		translationKey: "mergeBacklinkOutgoing",
		descriptionKey: "mergeBacklinkOutgoingDesc",
	},
	defineDropdown({
		section: "results",
		settingKey: "twoHopHeaderSortOrder",
		translationKey: "twoHopHeaderSortOrder",
		descriptionKey: "twoHopHeaderSortOrderDesc",
		options: [
			{ value: "appearance", label: "appearance", isTranslationKey: true },
			{
				value: "hop2-count-asc",
				label: "linkCountAscending",
				isTranslationKey: true,
			},
		],
	}),
	defineDropdown({
		section: "results",
		settingKey: "quickSortField1",
		translationKey: "quickSortField1",
		descriptionKey: "quickSortFieldDesc",
		options: QUICK_SORT_OPTIONS,
	}),
	defineDropdown({
		section: "results",
		settingKey: "quickSortField2",
		translationKey: "quickSortField2",
		descriptionKey: "quickSortFieldDesc",
		options: QUICK_SORT_OPTIONS,
	}),
	{
		section: "results",
		settingKey: "dedupeCards",
		controlType: "toggle",
		translationKey: "hideDuplicateNotes",
		descriptionKey: "hideDuplicateNotesDesc",
	},
	{
		section: "tags",
		settingKey: "enableTagFeatures",
		controlType: "toggle",
		translationKey: "enableTagFeatures",
		descriptionKey: "enableTagFeaturesDesc",
		refreshOnChange: true,
	},
	{
		section: "tags",
		settingKey: "showTagsSection",
		controlType: "toggle",
		translationKey: "showTagsSection",
		descriptionKey: "showTagsSectionDesc",
		disabled: (settings) => !settings.enableTagFeatures,
	},
	{
		section: "results",
		settingKey: "excludeAttachments",
		controlType: "toggle",
		translationKey: "hideAttachments",
		descriptionKey: "hideAttachmentsDesc",
	},
	{
		section: "unresolvedLinks",
		settingKey: "enableUnresolvedLinkDecoration",
		controlType: "toggle",
		translationKey: "highlightUnresolvedLinks",
		descriptionKey: "highlightUnresolvedLinksDesc",
	},
	{
		section: "tags",
		settingKey: "enableGlobalSearchTagModal",
		controlType: "toggle",
		translationKey: "openTagSearchDedicatedView",
		descriptionKey: "openTagSearchDedicatedViewDesc",
		disabled: (settings) => !settings.enableTagFeatures,
	},
	{
		section: "newTab",
		settingKey: "enableEmptyViewAllNotesInNewTab",
		controlType: "toggle",
		translationKey: "showAllNotesNewTab",
		descriptionKey: "showAllNotesNewTabDesc",
		refreshOnChange: true,
	},
	{
		section: "newTab",
		settingKey: "pinBookmarkedToTopInAllNotes",
		controlType: "toggle",
		translationKey: "pinBookmarkedToTopInAllNotes",
		descriptionKey: "pinBookmarkedToTopInAllNotesDesc",
		disabled: (settings) => !settings.enableEmptyViewAllNotesInNewTab,
	},
	{
		section: "results",
		settingKey: "frontmatterKeyCreatedDate",
		controlType: "text",
		translationKey: "frontmatterKeyCreationDate",
		descriptionKey: "frontmatterKeyCreationDateDesc",
		placeholder: "created",
		parse: (value) => parseTrimmedString(value),
		format: (value) => (typeof value === "string" ? value : ""),
	},
	{
		section: "results",
		settingKey: "frontmatterKeyModifiedDate",
		controlType: "text",
		translationKey: "frontmatterKeyModificationDate",
		descriptionKey: "frontmatterKeyModificationDateDesc",
		placeholder: "updated",
		parse: (value) => parseTrimmedString(value),
		format: (value) => (typeof value === "string" ? value : ""),
	},
];
