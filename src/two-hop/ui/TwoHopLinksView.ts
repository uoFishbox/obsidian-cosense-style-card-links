import { addIcon, ItemView, WorkspaceLeaf, TFile, type IconName } from "obsidian";
import type { PluginHost } from "obsidian-integration/pluginHost";
import type { TwoHopState } from "two-hop/state/TwoHopState.svelte";
import type { ViewServices } from "obsidian-integration/views/viewServices";
import {
	createDefaultTwoHopState,
	createLinkContextForView,
} from "obsidian-integration/views/viewFactories";
import {
	cleanupSvelteAndStore,
	type SvelteComponentInstance,
} from "obsidian-integration/views/svelteLifecycle";
import { mountTwoHopLinksRootView } from "./mountTwoHopLinksRootView";
import { getMainUiTranslations } from "shared/i18n/mainUiTranslations";
import { TWO_HOP_LINKS_VIEW_TYPE } from "obsidian-integration/views/viewTypes";

export { TWO_HOP_LINKS_VIEW_TYPE } from "obsidian-integration/views/viewTypes";

const TWO_HOP_LINKS_ICON: IconName = "cosense-card-links-layout-grid";

addIcon(
	TWO_HOP_LINKS_ICON,
	'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-grid"><g transform="scale(4.1666667)"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></g></svg>',
);

export interface ExternalListSurfaceLease {
	readonly element: HTMLElement;
	release(): void;
}

export class TwoHopLinksView extends ItemView {
	private component: SvelteComponentInstance | undefined = undefined;
	private applicationStore: TwoHopState | undefined = undefined;
	private currentFile: TFile | undefined = undefined;
	private lazyLoaderCache: Set<string> = new Set();
	private externalListSurfaceOwner:
		| { readonly id: symbol; readonly onReclaim: () => void }
		| undefined = undefined;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PluginHost,
		private readonly viewServices: ViewServices,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TWO_HOP_LINKS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Card links";
	}

	getIcon(): IconName {
		return TWO_HOP_LINKS_ICON;
	}

	async onOpen(): Promise<void> {
		this.clearContent();
	}

	public renderForFile(file: TFile): void {
		this.renderFile(file, { force: false });
	}

	public refreshFromSettings(): void {
		if (!this.currentFile) {
			if (!this.externalListSurfaceOwner) {
				this.clearContent();
			}
			return;
		}

		this.renderFile(this.currentFile, { force: true });
	}

	/**
	 * Hand the sidebar content area to another plugin-owned view.
	 *
	 * Temporary views such as pre-creation and tag notes keep their editor-like
	 * shell in the main workspace while rendering their link cards in this
	 * sidebar when sidebar display mode is active.
	 */
	public claimExternalListSurface(onReclaim: () => void): ExternalListSurfaceLease {
		this.reclaimExternalListSurface();
		this.currentFile = undefined;
		this.lazyLoaderCache.clear();
		[this.component, this.applicationStore] = cleanupSvelteAndStore(
			this.component,
			this.applicationStore,
		);
		this.contentEl.empty();
		this.resetSidebarScrollPosition();

		const ownerId = Symbol("external-list-surface-owner");
		this.externalListSurfaceOwner = { id: ownerId, onReclaim };
		return {
			element: this.contentEl,
			release: () => {
				if (this.externalListSurfaceOwner?.id !== ownerId) {
					return;
				}
				this.externalListSurfaceOwner = undefined;
				this.contentEl.empty();
				this.resetSidebarScrollPosition();
			},
		};
	}

	private renderFile(file: TFile, options: { force: boolean }): void {
		this.reclaimExternalListSurface();
		const isFileTransition = this.currentFile?.path !== file.path;

		// Skip re-rendering when the file is unchanged
		if (!options.force && !isFileTransition && this.component) {
			return;
		}

		// On file navigation, discard the LazyLoader cache to avoid retaining unnecessary references
		if (isFileTransition) {
			this.lazyLoaderCache.clear();
		}

		this.currentFile = file;

		[this.component, this.applicationStore] = cleanupSvelteAndStore(
			this.component,
			this.applicationStore,
		);

		const container = this.contentEl;
		container.empty();

		if (isFileTransition) {
			this.resetSidebarScrollPosition();
		}

		const applicationStore = createDefaultTwoHopState(
			this.viewServices,
			this.plugin.settings,
		);
		const linkContext = createLinkContextForView(
			this.viewServices,
			file,
			this.plugin.settings,
			{ wrapForView: false },
		);

		({ component: this.component, applicationStore: this.applicationStore } =
			mountTwoHopLinksRootView({
				target: container,
				app: this.plugin.app,
				file,
				settings: this.plugin.settings,
				applicationStore,
				linkContext,
				previewRuntime: this.viewServices.previewRuntime,
				lazyLoaderCache: this.lazyLoaderCache,
				keyboardNavigationSurfaceRegistry:
					this.viewServices.keyboardNavigationSurfaceRegistry,
				isSidebar: true,
				updateSetting: (key, value) => this.plugin.updateSetting(key, value),
			}));
	}

	/**
	 * Clear the view content and display a placeholder.
	 * Used when the sidebar has no file to render or hybrid mode hides its UI.
	 */
	public clearContent(): void {
		this.reclaimExternalListSurface();
		this.currentFile = undefined;
		this.lazyLoaderCache.clear();
		[this.component, this.applicationStore] = cleanupSvelteAndStore(
			this.component,
			this.applicationStore,
		);
		this.contentEl.empty();
		this.resetSidebarScrollPosition();
		const translations = getMainUiTranslations(this.plugin.settings.language);
		this.contentEl.createDiv({
			text:
				this.plugin.settings.displayMode === "sidebar-view"
					? translations.openFileToSeeLinks
					: translations.openNonMarkdownFile,
			cls: "cosense-card-links__sidebar-placeholder",
			attr: {
				style: "padding: 20px; text-align: center; color: var(--text-muted);",
			},
		});
	}

	private resetSidebarScrollPosition(): void {
		this.contentEl.scrollTop = 0;
	}

	private reclaimExternalListSurface(): void {
		const owner = this.externalListSurfaceOwner;
		if (!owner) {
			return;
		}

		this.externalListSurfaceOwner = undefined;
		owner.onReclaim();
	}

	async onClose(): Promise<void> {
		this.reclaimExternalListSurface();
		[this.component, this.applicationStore] = cleanupSvelteAndStore(
			this.component,
			this.applicationStore,
		);
		this.currentFile = undefined;
		this.lazyLoaderCache.clear();
	}
}
