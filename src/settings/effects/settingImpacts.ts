import type { PluginSettings } from "settings/model";

export type SettingImpact =
	| "invalidate-sort"
	| "reactivate-display-mode"
	| "refresh-card-views"
	| "update-decorated-views"
	| "sync-empty-view"
	| "rebuild-tag-index";

const STANDARD_IMPACTS = [
	"invalidate-sort",
	"reactivate-display-mode",
] as const satisfies ReadonlyArray<SettingImpact>;

/**
 * Explicit impact declaration for every runtime setting.
 * Adding a setting fails type checking until its effects are deliberately chosen.
 */
export const SETTING_IMPACTS = {
	language: [...STANDARD_IMPACTS, "refresh-card-views", "update-decorated-views"],
	displayMode: [...STANDARD_IMPACTS, "refresh-card-views"],
	useMergedLinksSection: STANDARD_IMPACTS,
	dedupeCards: STANDARD_IMPACTS,
	enableTagFeatures: [...STANDARD_IMPACTS, "refresh-card-views", "rebuild-tag-index"],
	showTagsSection: STANDARD_IMPACTS,
	defaultVisibleLinkCount: STANDARD_IMPACTS,
	loadMoreLinkIncrement: STANDARD_IMPACTS,
	cardWidthPx: [...STANDARD_IMPACTS, "refresh-card-views"],
	cardHeightRatio: [...STANDARD_IMPACTS, "refresh-card-views"],
	cardGapPx: [...STANDARD_IMPACTS, "refresh-card-views"],
	cardMaxColumns: [...STANDARD_IMPACTS, "refresh-card-views"],
	sectionMarginBottomPx: [...STANDARD_IMPACTS, "refresh-card-views"],
	highlightOnOpen: STANDARD_IMPACTS,
	highlightInPreviewOnHover: STANDARD_IMPACTS,
	twoHopHeaderSortOrder: STANDARD_IMPACTS,
	lastUsedSortOption: [],
	quickSortField1: ["reactivate-display-mode", "refresh-card-views"],
	quickSortField2: ["reactivate-display-mode", "refresh-card-views"],
	previewMaxLines: STANDARD_IMPACTS,
	previewMaxChars: STANDARD_IMPACTS,
	previewVisualLineSafetyMargin: STANDARD_IMPACTS,
	showTwoHopForSelectedCanvasFileNode: STANDARD_IMPACTS,
	mobileLongPressAction: STANDARD_IMPACTS,
	excludeAttachments: STANDARD_IMPACTS,
	frontmatterKeyCreatedDate: STANDARD_IMPACTS,
	frontmatterKeyModifiedDate: STANDARD_IMPACTS,
	enableGlobalSearchTagModal: STANDARD_IMPACTS,
	enableUnresolvedLinkModal: STANDARD_IMPACTS,
	enableEmptyViewAllNotesInNewTab: [...STANDARD_IMPACTS, "sync-empty-view"],
	pinBookmarkedToTopInAllNotes: STANDARD_IMPACTS,
	enableUnresolvedLinkDecoration: [...STANDARD_IMPACTS, "update-decorated-views"],
	experimentalCosenseTitleEditing: STANDARD_IMPACTS,
	experimentalShadowDomCss: [...STANDARD_IMPACTS, "refresh-card-views"],
	enableContentSearch: ["invalidate-sort"],
	priorityFrontmatterKeysForImagePreview: STANDARD_IMPACTS,
	priorityFrontmatterKeyForPreview: STANDARD_IMPACTS,
	priorityFrontmatterKeyForTitle: STANDARD_IMPACTS,
} as const satisfies Record<keyof PluginSettings, ReadonlyArray<SettingImpact>>;

export function collectSettingImpacts(
	changedKeys: Iterable<keyof PluginSettings>,
): ReadonlySet<SettingImpact> {
	const impacts = new Set<SettingImpact>();
	for (const key of changedKeys) {
		for (const impact of SETTING_IMPACTS[key]) {
			impacts.add(impact);
		}
	}
	return impacts;
}
