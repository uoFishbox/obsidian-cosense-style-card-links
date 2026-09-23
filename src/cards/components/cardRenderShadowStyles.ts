export const CARD_RENDER_SHADOW_CSS = String.raw`
.ccl-box-preview.is-stale {
	visibility: hidden;
}

:host {
	display: block;
}


.ccl-search-highlight {
    color: var(--text-normal);
	/* for obsidian 1.13.8 and earlier */
    background-color: var(--text-highlight-bg);
}

/* for obsidian 1.14.0 and later */
.ccl-search-highlight {
    background-color: var(--highlight-background);
}

.ccl-virtual-grid-content {
	position: relative;
	width: 100%;
	contain: layout;
}

.ccl-virtual-grid-cell {
	box-sizing: border-box;
	min-width: 0;
	width: var(--ccl-cell-width);
	flex: 0 0 var(--ccl-cell-width);
	height: var(--ccl-box-height);
	contain: layout;
}

.ccl-virtual-grid-row {
	position: absolute;
	inset-inline: 0;
	top: 0;
	margin-bottom: 0;
	width: 100%;
	height: var(--ccl-box-height);
	display: flex;
	gap: var(--ccl-box-gap);
	contain: layout;
}


.ccl-box {
	position: relative;
	box-sizing: border-box;
	width: 100%;
	height: var(--ccl-box-height);
	min-width: 0;
	min-height: var(--ccl-box-height);
	display: flex;
	flex-direction: column;
	border-radius: var(--ccl-box-radius);
	background-color: var(--ccl-bg-box);
	border: 1px solid var(--ccl-bg-box-top);
	cursor: pointer;
	overflow: visible;
	word-break: break-word;
	touch-action: auto;
}

.twohop-virtual-cell > .ccl-box {
	height: 100%;
	min-height: 0;
}

.twohop-card-shell.is-skeleton {
	pointer-events: none;
}

.twohop-card-shell.is-skeleton .ccl-box-title-wrapper::before {
	content: "";
	display: block;
	width: 62%;
	height: 0.8em;
	border-radius: 999px;
	background: var(--background-modifier-border);
}

.twohop-card-shell.is-skeleton.has-shell-title .ccl-box-title-wrapper::before {
	display: none;
}

.twohop-card-shell.is-skeleton.has-shell-title .ccl-box-title {
	opacity: 0.78;
}

@media (hover: hover) {
	.ccl-box:not(.ccl-connected-links-header)[data-ccl-hovered="true"] {
		border-color: var(--background-modifier-border-hover);
	}
}

.ccl-connected-links-header,
.ccl-twohop-header,
.ccl-properties-header,
.ccl-new-links-header,
.ccl-load-more-button {
	width: 100%;
	height: var(--ccl-box-height);
	min-height: var(--ccl-box-height);
	border-radius: var(--radius-m);
}

.ccl-connected-links-header,
.ccl-twohop-header,
.ccl-properties-header,
.ccl-new-links-header {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	gap: 14px;
	color: var(--ccl-box-text-content);
	font-size: 1em;
}

.ccl-connected-links-header {
	color: var(--color-base-20);
	background-color: var(--color-accent);
	border: none;
	cursor: default;
	padding: var(--ccl-box-padding);
}

.ccl-twohop-header {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	gap: 14px;
	color: var(--ccl-box-text-content);
	font-size: 1em;
	background-color: var(--ccl-bg-header-twohop);
	padding: var(--ccl-box-padding);
}

.ccl-box.ccl-box--missing {
	border: 1px dashed var(--color-base-40);
}

@media (hover: hover) {
	.ccl-twohop-header.ccl-box--missing:hover,
	.ccl-box.ccl-box--missing[data-ccl-hovered="true"] {
		border-color: var(--background-modifier-border-hover);
	}
}

.ccl-title-container {
	display: flex;
	flex-direction: column;
	min-height: 0;
	align-items: center;
	justify-content: center;
	width: 100%;
	gap: 10px;
	font-size: 0.95em;
	line-height: 1.1;
	word-break: break-word;
	overflow: clip;
}

.ccl-header-title {
	display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}

.ccl-box-title-wrapper {
	padding: var(--ccl-box-padding);
	display: block;
	flex: 0 0 auto;
	position: relative;
	z-index: auto;
	pointer-events: none;
}

.ccl-box-title {
	color: var(--ccl-title-box);
	font-weight: 600;
	font-size: 0.85em;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	line-clamp: 3;
	overflow: clip;
	line-height: 1.3;
}

.ccl-file-icon {
	display: inline-block;
	width: 1em;
	height: 1em;
	margin-inline-end: 4px;
	vertical-align: -0.125em;
	color: var(--text-muted);
}

.ccl-file-icon svg {
	display: block;
	width: 1em;
	height: 1em;
}

.ccl-box-extension {
	font-size: 9px;
	font-weight: 600;
	color: var(--nav-tag-color);
	text-transform: uppercase;
}

.ccl-box:focus-visible {
	box-shadow: inset 0 0 0 2px var(--background-modifier-border-focus);
	outline: none;
	border-color: var(--background-modifier-border-focus);
}


.ccl-box.ccl-box--missing .ccl-box-title {
	color: var(--color-base-50);
}

.ccl-box .ccl-connected-links-header {
	background-color: var(--ccl-bg-box) !important;
}

.ccl-code-block,
.ccl-inline-code {
	font-family: var(--font-monospace);
	color: var(--ccl-box-text-content);
	text-align: left;
	font-size: var(--code-size);
	word-spacing: normal;
	word-wrap: break-word;
	padding: 2px;
	background-color: var(--code-background);
	white-space: var(--code-white-space);
	border: var(--code-border-width) solid var(--code-border-color);
	border-radius: 3px;
}

.ccl-connected-links-header[data-ccl-section-variant="new-links"] {
	background-color: var(--ccl-single-backlink-unresolved) !important;
}

.ccl-box-bookmark-bg {
	position: absolute;
	top: -4px;
	right: 2px;
	color: var(--icon-color-active);
	pointer-events: none;
	z-index: 0;
}

.ccl-box-preview a,
.ccl-box-preview img,
.ccl-box-preview [draggable="true"] {
	-webkit-user-drag: none !important;
	user-drag: none !important;
}

.ccl-box-preview--text {
	padding: 0px var(--ccl-box-padding) 0px var(--ccl-box-padding);
	margin-bottom: var(--ccl-box-padding);
	/* Move overflowing lines into clipped columns, preserving complete lines. */
	column-count: 1;
	column-fill: auto;
	column-gap: calc(2 * var(--ccl-box-padding));
	orphans: 1;
	widows: 1;
} 

.ccl-box-preview--image {
	padding: 0px calc(var(--ccl-box-padding) / 2) 0px calc(var(--ccl-box-padding) / 2);
	margin-bottom: calc(var(--ccl-box-padding) / 2);
}

.ccl-box:not(.is-attachment)
	.ccl-box-preview--image {
	padding: 0;
	margin:
		0
		calc(var(--ccl-box-padding) / 2)
		calc(var(--ccl-box-padding) / 2);
	border-radius: var(--image-radius);
	overflow: clip;
}

.ccl-box-preview--text.ccl-search-preview {
	column-count: auto;
	position: relative;
}

.ccl-search-preview-body {
	display: flow-root;
	overflow-wrap: anywhere;
}

.ccl-search-preview-body .ccl-code-block,
.ccl-search-preview-body .ccl-inline-code {
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.ccl-search-preview-truncated::after {
	content: "…";
	position: absolute;
	right: 0;
	bottom: 0;
	background: var(--ccl-bg-box);
}

.lazy-placeholder {
	width: 100%;
	height: 100%;
	flex: 1 1 auto;
	min-height: inherit;
	background: transparent;
}

.ccl-box-preview {
	pointer-events: none !important;
	font-size: var(--ccl-preview-font-size);
	color: var(--ccl-box-text-content);
	white-space: pre-line;
	user-select: none;
	flex: 1 1 0;
	min-width: 0;
	min-height: 0;
	overflow: clip;
	contain: size layout paint;
}

.ccl-box-preview.hidden {
	display: none;
}

.ccl-box-preview .ccl-wikilink,
.ccl-box-preview .ccl-external-link {
	pointer-events: none;
}

.ccl-box-preview .canvas-minimap {
	padding: 0;
	max-height: 120px;
}

.ccl-box-preview--image img {
	display: block;
	width: 100%;
	height: auto;
	border-radius: var(--image-radius);
	-webkit-user-drag: none;
}

.ccl-box-preview .embed-title {
	display: none;
}

.ccl-box-preview mjx-container[jax="CHTML"][display="true"] {
	margin: 0;
}

.ccl-box-preview mjx-math[display="true"],
.ccl-box-preview math[display="block"] {
	font-size: 85%;
}

.ccl-wikilink,
.ccl-external-link {
	color: var(--link-color);
}

.ccl-external-link {
	text-decoration: underline;
}



.ccl-box[data-ccl-kb-row-selected="1"] {
	position: relative;
	border-color: var(--color-base-40);
}

.ccl-box[data-ccl-kb-row-selected="1"]::before {
	content: "";
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.ccl-box[data-ccl-kb-hint]::after {
	content: attr(data-ccl-kb-hint);
	position: absolute;
	bottom: 8px;
	right: 8px;
	min-width: 1.6em;
	padding: 2px 6px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--interactive-accent) 92%, black 8%);
	color: var(--text-on-accent);
	font-size: 1em;
	font-weight: normal;
	line-height: 1.4;
	text-align: center;
	text-transform: lowercase;
	letter-spacing: 0.02em;
	pointer-events: none;
	z-index: 1;
}

.ccl-load-more-button {
	display: flex;
	justify-content: center;
	align-items: center;
	background-color: transparent;
	border: none;
	color: var(--color-base-50);
	cursor: pointer;
	padding: 4px 0;
	width: 100%;
	height: 100%;
}

.ccl-load-more-button.ccl-box {
	border: none;
	box-shadow: none;
}

.ccl-load-more-button.ccl-box:focus-visible {
	box-shadow: inset 0 0 0 2px var(--background-modifier-border-focus);
}

.ccl-load-more-button > .ccl-box-title-wrapper {
	display: contents;
}

.twohop-virtual-surface {
	contain: layout paint style;
}

.twohop-virtual-content {
	position: relative;
	width: 100%;
}

.twohop-virtual-row[hidden] {
	display: none;
}

.twohop-virtual-row {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	display: grid;
	box-sizing: border-box;
	height: var(--ccl-box-height);
	grid-template-columns: repeat(var(--ccl-columns), minmax(0, 1fr));
	gap: var(--ccl-box-gap);
	contain: none;
}

.twohop-virtual-cell {
	min-width: 0;
	height: 100%;
}

@media (hover: hover) {
	.ccl-load-more-button.ccl-box:hover {
		color: var(--color-base-60);
		transition: color 0.2s ease;
	}
}

.ccl-box.is-attachment .ccl-box-preview--image img {
	border-radius: 0;
	display: block;
	width: 100%;
	height: auto;
}

.mod-canvas-color-1 {
  --canvas-color: var(--canvas-color-1);
}
.mod-canvas-color-2 {
  --canvas-color: var(--canvas-color-2);
}
.mod-canvas-color-3 {
  --canvas-color: var(--canvas-color-3);
}
.mod-canvas-color-4 {
  --canvas-color: var(--canvas-color-4);
}
.mod-canvas-color-5 {
  --canvas-color: var(--canvas-color-5);
}
.mod-canvas-color-6 {
  --canvas-color: var(--canvas-color-6);
}

.canvas-minimap {
  width: 100%;
  height: 100%;
  padding: var(--size-4-1);
}
.inline-embed > .canvas-minimap {
  max-height: var(--embed-canvas-max-height);
}
.canvas-minimap rect {
  stroke-width: 5px;
  stroke: var(--background-modifier-border);
  fill: var(--background-modifier-border);
  fill-opacity: 0.65;
}
.canvas-minimap rect.is-themed {
  stroke: var(--canvas-color);
  fill: var(--canvas-color);
  fill-opacity: 0.5;
}
.canvas-minimap path {
  stroke: #c0c0c0;
  fill: none;
}
.canvas-minimap path.is-themed {
  stroke: var(--canvas-color);
}
`;
