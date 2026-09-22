import type { Workspace } from "obsidian";
import type { PluginSettings } from "settings/model";
import type { IndexingService } from "indexing/index-service/IndexingService";
import type { SortService } from "cards/sorting/SortService";
import type { DisplayModeController } from "two-hop/display/DisplayModeController";
import type { EmptyViewController } from "obsidian-integration/lifecycle/emptyViewController";
import type { ViewUpdateOrchestrator } from "obsidian-integration/lifecycle/viewUpdateOrchestrator";
import { collectSettingImpacts } from "./settingImpacts";
/** View types that can re-render themselves after a settings change. */
const LAYOUT_REFRESHABLE_VIEW_TYPES: ReadonlyArray<string> = [
	"cosense-card-links-all-notes-view",
	"cosense-card-links-view",
	"cosense-card-links-tag-notes-view",
	"cosense-card-links-pre-create-view",
];

interface RefreshableFromSettings {
	refreshFromSettings(): void;
}

function isRefreshableFromSettings(view: unknown): view is RefreshableFromSettings {
	if (typeof view !== "object" || view === null) return false;
	return (
		typeof (view as { refreshFromSettings?: unknown }).refreshFromSettings ===
		"function"
	);
}

export interface SettingsSideEffectControllerDeps {
	readonly viewUpdateOrchestrator: ViewUpdateOrchestrator;
	readonly emptyViewController: EmptyViewController;
	readonly displayModeManager: DisplayModeController;
	readonly sortService: SortService;
	readonly invalidateAllNotesSorting: () => void;
	readonly indexingService: IndexingService;
	readonly workspace: Workspace;
	readonly bumpSortContextVersion: () => void;
}

/**
 * Encapsulates the imperative side effects triggered by setting changes,
 * keeping the plugin entry point free from handler wiring and view-type loops.
 */
export function createSettingsSideEffectController(
	deps: SettingsSideEffectControllerDeps,
): (changedKeys: Iterable<keyof PluginSettings>) => void {
	function refreshCardViews(): void {
		for (const viewType of LAYOUT_REFRESHABLE_VIEW_TYPES) {
			for (const leaf of deps.workspace.getLeavesOfType(viewType)) {
				if (isRefreshableFromSettings(leaf.view)) {
					leaf.view.refreshFromSettings();
				}
			}
		}

		deps.emptyViewController.refresh();
	}

	return (changedKeys): void => {
		const changedKeySet = new Set(changedKeys);
		if (changedKeySet.size === 0) {
			return;
		}
		const impacts = collectSettingImpacts(changedKeySet);

		if (impacts.has("update-decorated-views")) {
			deps.viewUpdateOrchestrator.updateAllViews();
		}
		if (impacts.has("sync-empty-view")) {
			deps.emptyViewController.sync();
		}
		if (impacts.has("rebuild-tag-index")) {
			deps.indexingService.invalidateAll();
			void deps.indexingService
				.enqueueRebuild("settings-change")
				.catch((error) => {
					console.error(
						"[Cosense card links] Failed to rebuild indexes after tag feature change:",
						error,
					);
				});
		}

		if (impacts.has("invalidate-sort")) {
			deps.sortService.invalidateCache();
			deps.bumpSortContextVersion();
			deps.invalidateAllNotesSorting();
		}
		if (impacts.has("reactivate-display-mode")) {
			deps.displayModeManager.handleSettingsChange();
		}
		if (impacts.has("refresh-card-views")) {
			refreshCardViews();
		}
	};
}
