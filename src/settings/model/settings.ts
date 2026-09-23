import type { QuickSortField, SortOption } from "cards/sorting";
export {
	DEFAULT_CARD_GAP_PX,
	DEFAULT_CARD_HEIGHT_PX,
	DEFAULT_CARD_HEIGHT_RATIO,
	DEFAULT_CARD_MAX_COLUMNS,
	DEFAULT_CARD_WIDTH_PX,
	DEFAULT_SECTION_MARGIN_BOTTOM_PX,
} from "cards/layout/cardLayoutCssVars";

export const LANGUAGES = ["en", "ja"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DISPLAY_MODES = ["editor-inline", "sidebar-view", "hybrid"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const TWO_HOP_HEADER_SORT_ORDERS = ["appearance", "hop2-count-asc"] as const;
export type TwoHopHeaderSortOrder = (typeof TWO_HOP_HEADER_SORT_ORDERS)[number];

export const MOBILE_LONG_PRESS_ACTIONS = ["preview", "menu"] as const;
export type MobileLongPressAction = (typeof MOBILE_LONG_PRESS_ACTIONS)[number];

/** Current persisted settings shape version; bump when keys are renamed or reshaped. */
export const SETTINGS_SCHEMA_VERSION = 3;

export const CARD_LAYOUT_SETTING_KEYS = [
	"cardWidthPx",
	"cardHeightRatio",
	"cardGapPx",
	"cardMaxColumns",
	"sectionMarginBottomPx",
] as const;

export type CardLayoutSettingKey = (typeof CARD_LAYOUT_SETTING_KEYS)[number];

export interface GeneralSettings {
	language: Language;
	displayMode: DisplayMode;
}

export interface ResultSettings {
	useMergedLinksSection: boolean;
	dedupeCards: boolean;
	defaultVisibleLinkCount: number;
	loadMoreLinkIncrement: number;
	twoHopHeaderSortOrder: TwoHopHeaderSortOrder;
	quickSortField1: QuickSortField;
	quickSortField2: QuickSortField;
	excludeAttachments: boolean;
	frontmatterKeyCreatedDate: string;
	frontmatterKeyModifiedDate: string;
}

export interface CardSettings {
	cardWidthPx: number;
	cardHeightRatio: number;
	cardGapPx: number;
	cardMaxColumns: number;
	sectionMarginBottomPx: number;
	previewMaxLines: number;
	previewMaxChars: number;
	previewVisualLineSafetyMargin: number;
	previewScrollCommitsPerSecond: number;
	priorityFrontmatterKeysForImagePreview: string;
	priorityFrontmatterKeyForPreview: string;
	priorityFrontmatterKeyForTitle: string;
}

export interface InteractionSettings {
	highlightOnOpen: boolean;
	highlightInPreviewOnHover: boolean;
	mobileLongPressAction: MobileLongPressAction;
}

export interface IntegrationSettings {
	enableTagFeatures: boolean;
	showTagsSection: boolean;
	showTwoHopForSelectedCanvasFileNode: boolean;
	enableGlobalSearchTagModal: boolean;
	enableUnresolvedLinkModal: boolean;
	enableEmptyViewAllNotesInNewTab: boolean;
	pinBookmarkedToTopInAllNotes: boolean;
	enableUnresolvedLinkDecoration: boolean;
}

export interface AdvancedSettings {
	/** Enables experimental Cosense-style title/body editing and note creation. */
	experimentalCosenseTitleEditing: boolean;
	/** CSS appended to each card-rendering Shadow DOM surface. */
	experimentalShadowDomCss: string;
}

/** Persisted UI choices changed from card surfaces rather than the settings tab. */
export interface UserPreferences {
	lastUsedSortOption: SortOption;
	enableContentSearch: boolean;
}

/**
 * Current runtime settings shape.
 *
 * The sectional interfaces keep feature contracts explicit while the persisted
 * representation remains flat during the first stage of the settings cleanup.
 */
export type ConfigSettings = GeneralSettings &
	ResultSettings &
	CardSettings &
	InteractionSettings &
	IntegrationSettings &
	AdvancedSettings;

export interface PluginSettings
	extends
		GeneralSettings,
		ResultSettings,
		CardSettings,
		InteractionSettings,
		IntegrationSettings,
		AdvancedSettings,
		UserPreferences {}

/** Versioned storage envelope written to Obsidian's plugin data file. */
export interface PersistedPluginData {
	readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
	readonly settings: ConfigSettings;
	readonly preferences: UserPreferences;
}
