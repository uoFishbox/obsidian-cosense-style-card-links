<script lang="ts">
	import { Platform, type TFile } from "obsidian";
	import Icon from "shared/ui/primitives/Icon.svelte";
	import { type IconName } from "shared/ui/icons/iconRegistry";
	import { isAttachment } from "obsidian-integration/files/fileRules";
	import { isImageExtension } from "card-preview/fileTypes";
	import { type Snippet } from "svelte";
	import { useAppContext } from "cards/context/linkContext";
	import { highlightTextForSearch } from "card-preview/text/searchHighlighter";
	import type { InteractionHandle } from "cards/interactions/interactionTypes";

	const AUDIO_EXTENSIONS = new Set([
		"mp3",
		"wav",
		"m4a",
		"ogg",
		"oga",
		"opus",
		"3gp",
		"flac",
		"aac",
	]);

	interface Props {
		title: string;
		ariaLabel: string;
		interactionHandle: InteractionHandle;
		interactive?: boolean;
		draggable?: boolean;
		children?: Snippet;
		className?: string;
		extension?: string;
		file?: TFile | null;
		searchQuery?: string;
	}

	let {
		title,
		ariaLabel,
		interactionHandle,
		interactive = true,
		draggable = true,
		children,
		className = "",
		extension,
		file = null,
		searchQuery = "",
	}: Props = $props();

	let appContext: ReturnType<typeof useAppContext> | undefined;
	try {
		appContext = useAppContext();
	} catch {
		appContext = undefined;
	}

	const lowerExtension = $derived(extension?.toLowerCase());

	/** Normalize the file extension (excluding md). */
	const normalizedExtension = $derived(
		lowerExtension && lowerExtension !== "md" ? lowerExtension : undefined,
	);

	/** Icon name for the extension (an ICONS key). */
	const fileIconName = $derived.by((): IconName | null => {
		if (!normalizedExtension) return null;
		return getFileIconName(normalizedExtension);
	});

	/** Determine the icon name to display for an extension. */
	function getFileIconName(ext: string): IconName {
		if (isImageExtension(ext)) return "Image";
		if (ext === "pdf") return "FileText";
		if (AUDIO_EXTENSIONS.has(ext)) return "FileAudio";
		if (ext === "canvas") return "LayoutDashboard";
		if (ext === "base") return "LayoutList";
		return "File";
	}

	const isAttachmentFile = $derived(isAttachment(extension));
	const extensionClass = $derived(lowerExtension ? `ext-${lowerExtension}` : "");
	const hasSearchQuery = $derived(searchQuery.trim().length > 0);
	const bookmarkedPathSet = appContext?.bookmarks.filePaths;
	const showBookmarkIcon = $derived(
		file ? (bookmarkedPathSet?.has(file.path) ?? false) : false,
	);

	function renderHighlightedTitle(): string {
		return highlightTextForSearch(title, searchQuery);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="ccl-box {className} {extensionClass}"
	class:is-attachment={isAttachmentFile}
	role={interactive ? "button" : undefined}
	tabindex={interactive ? 0 : undefined}
	aria-label={interactive ? ariaLabel : undefined}
	data-ccl-tooltip={interactive ? ariaLabel : undefined}
	aria-hidden={interactive ? undefined : "true"}
	data-ccl-interaction-handle={interactive ? interactionHandle : undefined}
	draggable={interactive && draggable && !Platform.isMobile ? true : undefined}
>
	<div class="ccl-box-title-wrapper">
		<div class="ccl-box-title">
			{#if fileIconName}
				<span class="ccl-file-icon">
					<Icon name={fileIconName} width={16} height={16} />
				</span>
			{/if}
			{#if hasSearchQuery}
				{@html renderHighlightedTitle()}
			{:else}
				{title}
			{/if}
		</div>
		{#if normalizedExtension}
			<span class="ccl-box-extension">
				{normalizedExtension}
			</span>
		{/if}
	</div>
	{@render children?.()}
	{#if showBookmarkIcon}
		<div class="ccl-box-bookmark-bg">
			<Icon
				name="Bookmark"
				width={22}
				height={22}
				fill="currentColor"
				stroke="none"
			/>
		</div>
	{/if}
</div>

<style>
	.ccl-box--existing {
		border-style: solid;
	}

	.ccl-box--missing .ccl-box-title {
		color: var(--color-base-50);
	}
</style>
