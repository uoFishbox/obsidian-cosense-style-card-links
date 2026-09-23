<script lang="ts" generics="T">
	import CardGridSurface from "cards/grid/surface/CardGridSurface.svelte";
	import CardGridLoadMoreButton from "cards/grid/ui/CardGridLoadMoreButton.svelte";
	import { useFlatCardGrid } from "cards/grid/runtime/flat-grid/useFlatCardGrid.svelte";
	import type { FlatCardGridProps } from "cards/grid/runtime/flat-grid/flatCardGridContract";
	import { provideVirtualPreviewSurface } from "card-preview/ui/virtualPreviewSurfaceContext";
	import { provideVirtualFrameCoordinator } from "shared/ui/scheduling/frameCoordinatorContext.svelte";

	const props: FlatCardGridProps<T> = $props();
	const frameCoordinator = provideVirtualFrameCoordinator();
	const list = useFlatCardGrid(props, frameCoordinator);
	provideVirtualPreviewSurface(list.previewSurface);
</script>

{#if list.itemCount === 0}
	{@render props.empty?.()}
{:else}
	<CardGridSurface
		className={`ccl-virtual-grid ${list.className}`.trim()}
		contentClassName="ccl-virtual-grid-content"
		rowClassName="ccl-virtual-grid-row"
		cellClassName="ccl-virtual-grid-cell"
		contentHeight={list.contentHeight}
		hasNavigableResults={list.itemCount > 0}
		cellWidth={list.layout.cellWidth}
		rowHeight={list.layout.rowHeight}
		columns={list.layout.columns}
		mountedRows={list.mountedRows}
		focusRequest={list.focusRequest}
		bind:rootEl={list.sectionRootEl}
		bind:contentEl={list.contentEl}
		bind:interactionShadowRoot={list.interactionShadowRoot}
		scrollContainerEl={list.scrollContainerEl}
		slotBodyRevision={list.slotBindingRevision}
		resolveNavigationTarget={list.resolveNavigationTarget}
		resolveSequentialNavigationTarget={list.resolveSequentialNavigationTarget}
		onMoveFocusAboveGrid={props.onMoveFocusAboveGrid}
		flushVirtualScrollMeasurement={list.flushVirtualScrollMeasurement}
		interactionDescriptorResolverProvider={list.interactionDescriptorResolverProvider}
	>
		{#snippet renderCell({ mountedCell, scrollContainerEl })}
			{#if mountedCell.cell.kind === "header"}
				{@render props.header?.()}
			{:else if mountedCell.cell.kind === "item"}
				{#if props.item}
					{@const itemRenderArgs = list.createItemRenderArgs(
						mountedCell,
						scrollContainerEl,
					)}
					{#if itemRenderArgs}
						{@render props.item(itemRenderArgs)}
					{/if}
				{/if}
			{:else}
				<CardGridLoadMoreButton
					onClick={list.loadNextPage}
					language={props.language}
				/>
			{/if}
		{/snippet}
		{#snippet afterContent()}
			{#if list.shouldUseInfiniteScroll && list.canLoadMore}
				<div
					bind:this={list.infiniteScrollSentinelEl}
					class="ccl-infinite-scroll-sentinel"
					style:top={`${list.layout.contentHeight}px`}
					aria-hidden="true"
				></div>
			{/if}
		{/snippet}
	</CardGridSurface>
{/if}

<style>
	:global(.ccl-virtual-grid) {
		position: relative;
		width: 100%;
		overflow-anchor: none;
	}

	:global(.ccl-virtual-grid-content) {
		position: relative;
		width: 100%;
	}

	:global(.ccl-virtual-grid-cell) {
		box-sizing: border-box;
		min-width: 0;
		width: var(--ccl-cell-width);
		flex: 0 0 var(--ccl-cell-width);
		height: var(--ccl-box-height);
	}

	:global(.ccl-virtual-grid-row) {
		position: relative;
		width: 100%;
		height: var(--ccl-box-height);
		display: flex;
		gap: var(--ccl-box-gap);
		contain: layout;
	}

	:global(.ccl-infinite-scroll-sentinel) {
		position: absolute;
		left: 0;
		width: 1px;
		height: 1px;
		pointer-events: none;
	}
</style>
