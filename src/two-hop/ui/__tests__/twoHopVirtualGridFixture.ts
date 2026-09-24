import { render } from "@testing-library/svelte";
import { vi, type Mock } from "vitest";
import { DEFAULT_SETTINGS } from "settings/model";
import type { CardCollectionState } from "cards/CardCollectionState.svelte";
import type { CardRenderModel } from "cards/rendering/cardRenderModel";
import type { LinkContext } from "cards/context/linkContext";
import {
	createTwoHopSectionModel,
	type TwoHopItemModel,
	type TwoHopSectionModel,
} from "two-hop/ui/twoHopSectionModel";
import {
	flushFrames,
	setElementRect,
	setNumericProperty,
	triggerResize,
} from "testing/helpers/DOMObserverMock";
import TwoHopVirtualGridHarness from "./TwoHopVirtualGridHarness.svelte";

export interface VirtualGridSurfaceFixture {
	readonly root: HTMLElement;
	readonly scroller: HTMLElement;
	readonly rerender: ReturnType<typeof render>["rerender"];
	readonly publishSection: (
		section: TwoHopSectionModel,
		cardModelRevision?: unknown,
		layoutAnchorScope?: string,
	) => Promise<void>;
}

export interface RenderVirtualGridSurfaceOptions {
	section: TwoHopSectionModel;
	resolveItemCardModel: (item: TwoHopItemModel, revision: unknown) => CardRenderModel;
	linkContext?: LinkContext;
	loadMoreSection?: (sectionId: string) => void;
	rootTop?: number;
	cardModelRevision?: unknown;
	layoutAnchorScope?: string;
}

/** Creates a section with predictable item identities for grid tests. */
export function createSection(count: number, totalCount = count): TwoHopSectionModel {
	const items = Array.from({ length: count }, (_, index) => ({
		item: { type: "newLink" },
		searchKey: `item:${index}`,
		key: `item:${index}`,
	})) as TwoHopItemModel[];
	return createTwoHopSectionModel({
		id: "section",
		kind: "new-links-section",
		title: "Section",
		items,
		totalCount,
	});
}

/** Resolves a grid item to a minimal card while retaining Vitest call records. */
export function createCardModelResolver(): Mock<
	(item: TwoHopItemModel, revision: unknown) => CardRenderModel
> {
	return vi.fn(
		(item: TwoHopItemModel, _revision: unknown): CardRenderModel => ({
			item: item.item,
			targetFile: null,
			title: item.key,
			ariaLabel: item.key,
			className: null,
			extension: null,
			interactionDescriptor: null,
			searchQuery: "",
			previewRequest: null,
		}),
	);
}

/** Renders and measures the shared virtual-grid surface. */
export async function renderSurface(
	params: RenderVirtualGridSurfaceOptions,
): Promise<VirtualGridSurfaceFixture> {
	const applicationStore = {
		settings: {
			...DEFAULT_SETTINGS,
			cardWidthPx: 100,
			cardHeightRatio: 1,
			cardMaxColumns: 3,
		},
	} as unknown as CardCollectionState;
	const scroller = document.createElement("div");
	scroller.style.overflow = "auto";
	setNumericProperty(scroller, "clientWidth", 320);
	setNumericProperty(scroller, "clientHeight", 300);
	setNumericProperty(scroller, "scrollHeight", 40_000);
	setNumericProperty(scroller, "scrollTop", 0);
	setElementRect(scroller, { top: 0, width: 320, height: 300 });
	document.body.append(scroller);

	const baseProps = {
		sections: [params.section],
		layoutAnchorScope: params.layoutAnchorScope ?? "default",
		applicationStore,
		linkContext:
			params.linkContext ?? ({ getPreview: vi.fn() } as unknown as LinkContext),
		loadMoreSection: params.loadMoreSection,
		resolveItemCardModel: params.resolveItemCardModel,
		cardModelRevision: params.cardModelRevision ?? 0,
	};
	const rendered = render(TwoHopVirtualGridHarness, {
		target: scroller,
		props: baseProps,
	});
	const root = rendered.container.querySelector<HTMLElement>(
		".twohop-virtual-surface",
	);
	if (!root) throw new Error("Two-hop virtual surface was not rendered");
	setElementRect(root, {
		top: params.rootTop ?? 0,
		width: 320,
		height: 40_000,
	});
	triggerResize(root, 320, 40_000);
	for (let index = 0; index < 4; index += 1) await flushFrames();

	return {
		root,
		scroller,
		rerender: rendered.rerender,
		publishSection: (
			section,
			cardModelRevision = baseProps.cardModelRevision,
			layoutAnchorScope = baseProps.layoutAnchorScope,
		) =>
			rendered.rerender({
				...baseProps,
				sections: [section],
				cardModelRevision,
				layoutAnchorScope,
			}),
	};
}
