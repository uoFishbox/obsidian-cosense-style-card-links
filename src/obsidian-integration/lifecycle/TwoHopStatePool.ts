import type { IIndexingService } from "indexing/index-service/IndexingService";
import type { PluginSettings } from "settings/model";
import type { SortOption } from "cards/sorting";
import type { DisplayDataBuilder } from "two-hop/display/displayDataBuilder";
import { TwoHopState } from "two-hop/state/TwoHopState.svelte";
import type { ResolveTwoHopLinks } from "two-hop/state/TwoHopLinksLoader";

export interface TwoHopStatePoolOptions {
	indexingService: IIndexingService;
	createDisplayDataBuilder: () => DisplayDataBuilder;
	updateSortOption: (option: SortOption) => void;
	updateContentSearch?: (enabled: boolean) => void;
}

interface ActiveTwoHopStateEntry {
	state: TwoHopState;
	refCount: number;
}

/** Shares active TwoHopState instances and destroys them when their last owner releases. */
export class TwoHopStatePool {
	private readonly activeStates = new Map<string, ActiveTwoHopStateEntry>();
	private readonly displayDataBuilders = new Map<string, DisplayDataBuilder>();

	constructor(private readonly options: TwoHopStatePoolOptions) {}

	create(
		settings: PluginSettings,
		buildDisplayData: DisplayDataBuilder,
		resolveTwoHopLinks: ResolveTwoHopLinks,
	): TwoHopState {
		const store = new TwoHopState(
			settings,
			buildDisplayData,
			resolveTwoHopLinks,
			this.options.updateSortOption,
			this.options.updateContentSearch,
		);
		const unsubscribe = this.options.indexingService.onDataUpdate((context) => {
			store.handleDataUpdate(context);
		});
		store.subscribeToDataUpdates(unsubscribe);
		return store;
	}

	getOrCreateDisplayDataBuilder(leafId: string): DisplayDataBuilder {
		let displayDataBuilder = this.displayDataBuilders.get(leafId);
		if (!displayDataBuilder) {
			displayDataBuilder = this.options.createDisplayDataBuilder();
			this.displayDataBuilders.set(leafId, displayDataBuilder);
		}
		return displayDataBuilder;
	}

	acquire(
		leafId: string,
		filePath: string,
		settings: PluginSettings,
		buildDisplayData: DisplayDataBuilder,
		resolveTwoHopLinks: ResolveTwoHopLinks,
	): TwoHopState {
		const key = buildStoreKey(leafId, filePath);
		const activeEntry = this.activeStates.get(key);
		if (activeEntry) {
			activeEntry.refCount += 1;
			return activeEntry.state;
		}

		const state = this.create(settings, buildDisplayData, resolveTwoHopLinks);
		this.activeStates.set(key, { state, refCount: 1 });
		return state;
	}

	release(leafId: string, filePath: string): void {
		const key = buildStoreKey(leafId, filePath);
		const activeEntry = this.activeStates.get(key);
		if (!activeEntry) return;

		activeEntry.refCount -= 1;
		if (activeEntry.refCount > 0) {
			return;
		}

		activeEntry.state.destroy();
		this.activeStates.delete(key);
		this.maybeReleaseDisplayDataBuilder(leafId);
	}

	destroy(): void {
		for (const { state } of this.activeStates.values()) {
			state.destroy();
		}
		this.activeStates.clear();
		this.displayDataBuilders.clear();
	}

	private maybeReleaseDisplayDataBuilder(leafId: string): void {
		const prefix = `${leafId}:`;
		for (const key of this.activeStates.keys()) {
			if (key.startsWith(prefix)) return;
		}
		this.displayDataBuilders.delete(leafId);
	}
}

function buildStoreKey(leafId: string, filePath: string): string {
	return `${leafId}:${filePath}`;
}
