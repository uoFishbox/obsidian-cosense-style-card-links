<script lang="ts">
	import InteractiveSectionHeader from "obsidian-integration/interactions/InteractiveSectionHeader.svelte";
	import Icon from "shared/ui/primitives/Icon.svelte";
	import LinkItem from "cards/components/LinkItem.svelte";
	import CardGridLoadMoreButton from "cards/grid/ui/CardGridLoadMoreButton.svelte";
	import UnresolvedPreviewPlaceholder from "card-preview/ui/UnresolvedPreviewPlaceholder.svelte";
	import { previewHost } from "card-preview/ui/previewHostAction";
	import type { CardSectionVariant } from "cards/components/cardPresentation";
	import type { CardRenderModel } from "cards/rendering/cardRenderModel";
	import type { IconName } from "shared/ui/icons/iconRegistry";
	import type { TwoHopVirtualCell } from "two-hop/ui/virtual-grid/rowModel";
	import type { TwoHopSectionModel } from "two-hop/ui/twoHopSectionModel";
	import {
		createInteractionHandle,
		type InteractionHandle,
	} from "cards/interactions/interactionTypes";
	import type { Language } from "settings/model";
	import { getMainUiTranslations } from "shared/i18n/mainUiTranslations";
	import { untrack } from "svelte";

	interface Props {
		cell: TwoHopVirtualCell;
		interactionHandle?: InteractionHandle;
		previewHostEnabled: boolean;
		previewKey: string;
		registerCardModelConsumer: (
			logicalKey: string,
			consumer: (model: CardRenderModel | undefined) => void,
		) => () => void;
		onLoadMore: (sectionId: string, wasFocused: boolean) => void;
		language?: Language;
	}

	let {
		cell,
		interactionHandle,
		previewHostEnabled,
		previewKey,
		registerCardModelConsumer,
		onLoadMore,
		language = "en",
	}: Props = $props();
	const text = $derived(getMainUiTranslations(language));
	let cardModel = $state.raw<CardRenderModel | undefined>(undefined);
	let boundLogicalKey = untrack(() => cell.logicalKey);
	const fallbackInteractionHandle = createInteractionHandle("c");
	const resolvedInteractionHandle = $derived(
		interactionHandle ?? fallbackInteractionHandle,
	);

	$effect(() => {
		const nextLogicalKey = cell.logicalKey;
		if (nextLogicalKey !== boundLogicalKey) {
			boundLogicalKey = nextLogicalKey;
			cardModel = undefined;
		}

		if (cell.kind !== "item") {
			cardModel = undefined;
			return;
		}
		return registerCardModelConsumer(nextLogicalKey, (nextModel) => {
			cardModel = nextModel;
		});
	});

	function resolveHeaderIcon(): IconName {
		switch (cell.section.kind) {
			case "new-links-section":
				return "Unlink";
			case "tag-section":
				return "Tag";
			case "primary-section":
			case "two-hop-branch":
				return "Link";
		}
	}

	function resolveTwoHopSectionVariant(
		section: TwoHopSectionModel,
	): CardSectionVariant {
		switch (section.kind) {
			case "new-links-section":
				return "new-links";
			case "tag-section":
				return "tag";
			case "two-hop-branch":
				return "two-hop";
			case "primary-section":
				switch (section.id) {
					case "outgoing":
						return "outgoing";
					case "merged":
						return "merged";
					default:
						return "backlinks";
				}
		}
	}
</script>

{#if cell.kind === "header"}
	{@const section = cell.section}
	{@const headerProps = section.header.props}
	{@const sectionVariant = resolveTwoHopSectionVariant(section)}
	{#if headerProps.interactionDescriptor || headerProps.onClick}
		<InteractiveSectionHeader
			title={section.title}
			count={section.totalCount}
			className={headerProps.className}
			draggable={headerProps.draggable}
			interactionDescriptor={headerProps.interactionDescriptor}
			onClick={headerProps.onClick}
			{sectionVariant}
		>
			{#snippet icon()}
				<Icon
					name={resolveHeaderIcon()}
					width={26}
					height={26}
					class="twohop-links-icon"
				/>
			{/snippet}
		</InteractiveSectionHeader>
	{:else}
		<div
			class="ccl-box ccl-connected-links-header {headerProps.className ?? ''}"
			aria-label={text.noteCount(section.totalCount)}
			data-ccl-section-variant={sectionVariant}
		>
			<div class="ccl-title-container">
				<span class="ccl-header-title">{section.title}</span>
				<Icon
					name={resolveHeaderIcon()}
					width={26}
					height={26}
					class="twohop-links-icon"
				/>
			</div>
		</div>
	{/if}
{:else if cell.kind === "load-more"}
	<CardGridLoadMoreButton
		onClick={(wasFocused) => onLoadMore(cell.section.id, wasFocused)}
		{language}
	/>
{:else}
	{@const model = cardModel}
	<LinkItem
		title={model?.title ?? ""}
		ariaLabel={model?.ariaLabel ?? ""}
		file={model?.targetFile ?? null}
		extension={model?.extension ?? undefined}
		interactionHandle={resolvedInteractionHandle}
		interactive={Boolean(model?.interactionDescriptor)}
		draggable={Boolean(model?.interactionDescriptor)}
		className={model
			? (model.className ?? undefined)
			: "twohop-card-shell is-skeleton"}
		searchQuery={model?.searchQuery ?? ""}
	>
		{#snippet children()}
			{#if model && model.item.type === "newLink" && !model.targetFile}
				<UnresolvedPreviewPlaceholder />
			{:else if model && model.targetFile && previewHostEnabled}
				<div use:previewHost={previewKey} class="ccl-box-preview"></div>
			{/if}
		{/snippet}
	</LinkItem>
{/if}
