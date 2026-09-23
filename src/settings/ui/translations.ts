import type { Language } from "settings/model";

export type TranslationKey =
	| "language"
	| "languageDesc"
	| "general"
	| "resultsAndSorting"
	| "sectionTags"
	| "sectionUnresolvedLinks"
	| "sectionNewTab"
	| "advanced"
	| "invalidSettingValue"
	| "displayMode"
	| "displayModeEditorInlineDesc"
	| "displayModeSidebarDesc"
	| "displayModeHybridDesc"
	| "defaultVisibleLinkCount"
	| "defaultVisibleLinkCountDesc"
	| "loadMoreLinkIncrement"
	| "loadMoreLinkIncrementDesc"
	| "cardWidth"
	| "cardWidthDesc"
	| "cardHeightRatio"
	| "cardHeightRatioDesc"
	| "cardGap"
	| "cardGapDesc"
	| "cardMaxColumns"
	| "cardMaxColumnsDesc"
	| "previewScrollSpeed"
	| "previewScrollSpeedDesc"
	| "sectionMarginBottom"
	| "sectionMarginBottomDesc"
	| "mergeBacklinkOutgoing"
	| "mergeBacklinkOutgoingDesc"
	| "twoHopHeaderSortOrder"
	| "twoHopHeaderSortOrderDesc"
	| "quickSortField1"
	| "quickSortField2"
	| "quickSortFieldDesc"
	| "none"
	| "sortRelevance"
	| "sortTitle"
	| "sortBacklinks"
	| "sortCreatedDate"
	| "sortModifiedDate"
	| "sortFileSize"
	| "hideDuplicateNotes"
	| "hideDuplicateNotesDesc"
	| "enableTagFeatures"
	| "enableTagFeaturesDesc"
	| "showTagsSection"
	| "showTagsSectionDesc"
	| "hideAttachments"
	| "hideAttachmentsDesc"
	| "highlightUnresolvedLinks"
	| "highlightUnresolvedLinksDesc"
	| "priorityFrontmatterKeysForImagePreview"
	| "priorityFrontmatterKeysForImagePreviewDesc"
	| "priorityFrontmatterKeyForPreview"
	| "priorityFrontmatterKeyForPreviewDesc"
	| "priorityFrontmatterKeyForTitle"
	| "priorityFrontmatterKeyForTitleDesc"
	| "interaction"
	| "experimentalCosenseTitleEditing"
	| "experimentalCosenseTitleEditingDesc"
	| "experimentalShadowDomCss"
	| "experimentalShadowDomCssDesc"
	| "highlightOnOpen"
	| "highlightOnOpenDesc"
	| "highlightInPopoverOnHover"
	| "highlightInPopoverOnHoverDesc"
	| "openTagSearchDedicatedView"
	| "openTagSearchDedicatedViewDesc"
	| "openUnresolvedNoteView"
	| "openUnresolvedNoteViewDesc"
	| "showAllNotesNewTab"
	| "showAllNotesNewTabDesc"
	| "pinBookmarkedToTopInAllNotes"
	| "pinBookmarkedToTopInAllNotesDesc"
	| "frontmatterKeyCreationDate"
	| "frontmatterKeyCreationDateDesc"
	| "frontmatterKeyModificationDate"
	| "frontmatterKeyModificationDateDesc"
	| "belowEditor"
	| "sidebar"
	| "hybrid"
	| "appearance"
	| "linkCountAscending"
	| "card";

const translations: Record<Language, Record<TranslationKey, string>> = {
	en: {
		experimentalCosenseTitleEditing: "Experimental: Cosense-style title editing",
		experimentalCosenseTitleEditingDesc:
			"In edit mode, seamlessly move the caret and edit text between the title and body.",
		experimentalShadowDomCss: "Experimental: Shadow DOM custom CSS",
		experimentalShadowDomCssDesc:
			"Append CSS to card-rendering Shadow DOM surfaces. Changes apply immediately. Invalid CSS may break card display.",
		language: "Language",
		languageDesc: "Select the display language for the UI.",
		general: "General",
		resultsAndSorting: "Results and sorting",
		sectionTags: "Tags",
		sectionUnresolvedLinks: "Unresolved links",
		sectionNewTab: "New tabs and all notes",
		advanced: "Advanced",
		invalidSettingValue: "Enter a valid value.",
		displayMode: "Display mode",
		displayModeEditorInlineDesc:
			"Displays links below the editor for Markdown files only. Links are not displayed for other file types.",
		displayModeSidebarDesc: "Displays links in the sidebar for all files.",
		displayModeHybridDesc:
			"Displays links below the editor for Markdown files and in the sidebar for all other file types.",
		defaultVisibleLinkCount: "Default visible link count",
		defaultVisibleLinkCountDesc:
			"The default number of links to display in each section.",
		loadMoreLinkIncrement: "Increment when loading more links",
		loadMoreLinkIncrementDesc:
			"The number of additional links to load when clicking 'Load more'.",
		cardWidth: "Card width (px)",
		cardWidthDesc: "Set the card width used by the responsive grid layout.",
		cardHeightRatio: "Card height ratio",
		cardHeightRatioDesc:
			"Set card height as a ratio of the actual rendered card width. Example: 1.1 means height = width x 1.1.",
		cardGap: "Card gap (px)",
		cardGapDesc:
			"Set the spacing between cards in the responsive grid layout. Set to 0 for no gap.",
		cardMaxColumns: "Maximum card columns",
		cardMaxColumnsDesc:
			"Set the upper limit for the number of columns in the responsive grid layout.",
		previewScrollSpeed: "Preview speed while scrolling (text/s)",
		previewScrollSpeedDesc:
			"Set the maximum number of text preview updates per second while scrolling. Adjust it based on your device's performance.",
		sectionMarginBottom: "Section bottom margin (px)",
		sectionMarginBottomDesc: "Set the bottom spacing between sections.",
		mergeBacklinkOutgoing: "Merge Backlink and Outgoing link sections",
		mergeBacklinkOutgoingDesc:
			'Merge Backlink and Outgoing link into a single "Links" section.',
		twoHopHeaderSortOrder: "2-hop link header sort order",
		twoHopHeaderSortOrderDesc:
			"The display order of headers within the '2-hop link' section.",
		quickSortField1: "Pinned sort 1",
		quickSortField2: "Pinned sort 2",
		quickSortFieldDesc:
			"Show this sort field beside the sort menu. Select None to leave the slot empty; duplicate fields are shown only once.",
		none: "None",
		sortRelevance: "Related",
		sortTitle: "Title",
		sortBacklinks: "Backlinks",
		sortCreatedDate: "Created",
		sortModifiedDate: "Modified",
		sortFileSize: "File size",
		hideDuplicateNotes: "Hide duplicate notes",
		hideDuplicateNotesDesc:
			"Hide notes that are already displayed in higher sections.",
		enableTagFeatures: "Enable tag features",
		enableTagFeaturesDesc:
			"Enable tag pages, tag search interception, and tag index building.",
		showTagsSection: "Show tags section",
		showTagsSectionDesc:
			"Display notes that have the same tags as the current note.",
		hideAttachments: "Hide attachments",
		hideAttachmentsDesc:
			"Exclude attachment files from results such as Backlinks and related links.",
		highlightUnresolvedLinks: "Highlight unresolved links with single Backlink",
		highlightUnresolvedLinksDesc:
			"Change the appearance of unresolved links that have only one Backlink.",
		priorityFrontmatterKeysForImagePreview: "Priority properties for image preview",
		priorityFrontmatterKeysForImagePreviewDesc:
			"Enter property names separated by commas in priority order. The first valid image URL or internal image link is displayed as the image preview.",
		priorityFrontmatterKeyForPreview: "Priority properties for text preview",
		priorityFrontmatterKeyForPreviewDesc:
			"Enter property names separated by commas in priority order. The first non-empty value is displayed as the text preview instead of the file content.",
		priorityFrontmatterKeyForTitle: "Priority properties for card title",
		priorityFrontmatterKeyForTitleDesc:
			"Enter property names separated by commas in priority order. The first non-empty value is displayed as the card title instead of the usual title.",
		interaction: "Interaction",
		highlightOnOpen: "Highlight on open",
		highlightOnOpenDesc:
			"Scroll to and highlight the position when opening a Backlink or an Outgoing link with location information.",
		highlightInPopoverOnHover: "Highlight in popover on hover",
		highlightInPopoverOnHoverDesc:
			"Highlight the link location in the popover displayed when hovering over a card.",
		openTagSearchDedicatedView: "Open tag search results in a dedicated view",
		openTagSearchDedicatedViewDesc: "Open the tag list in a dedicated tag view.",
		openUnresolvedNoteView: "Check Backlinks when creating unresolved links",
		openUnresolvedNoteViewDesc:
			"When clicking on an unresolved link with two or more Backlinks, open a temporary pre-creation view before creating a new file.",
		showAllNotesNewTab: "Show all notes in New Tab (Empty View)",
		showAllNotesNewTabDesc:
			"When enabled, opening a New Tab with Empty View shows all markdown notes as cards with infinite scroll.",
		pinBookmarkedToTopInAllNotes: "Pin bookmarked notes to top",
		pinBookmarkedToTopInAllNotesDesc:
			"Pin bookmarked notes to the top of the All Notes view.",
		frontmatterKeyCreationDate: "Property to use for creation date",
		frontmatterKeyCreationDateDesc:
			"If specified, use the value of this property instead of the file's creation date (e.g., created). If empty, use the file's creation date.",
		frontmatterKeyModificationDate: "Property to use for modification date",
		frontmatterKeyModificationDateDesc:
			"If specified, use the value of this property instead of the file's modification date (e.g., updated). If empty, use the file's modification date.",
		belowEditor: "Below editor",
		sidebar: "Sidebar",
		hybrid: "Hybrid",
		appearance: "Appearance",
		linkCountAscending: "Link count (ascending)",
		card: "Card",
	},
	ja: {
		experimentalCosenseTitleEditing: "Experimental: Cosenseスタイルのタイトル編集",
		experimentalCosenseTitleEditingDesc:
			"編集モードで、タイトルと本文の間のキャレット移動・テキスト編集をシームレスにします。",
		experimentalShadowDomCss: "Experimental: Shadow DOM カスタム CSS",
		experimentalShadowDomCssDesc:
			"カード描画用 Shadow DOM に CSS を追加します。変更はすぐに反映されます。不正な CSS によりカード表示が崩れる場合があります。",
		language: "言語",
		languageDesc: "UIの表示言語を選択します。",
		general: "一般",
		resultsAndSorting: "結果と並び替え",
		sectionTags: "タグ",
		sectionUnresolvedLinks: "未解決リンク",
		sectionNewTab: "新規タブとすべてのノート",
		advanced: "高度な設定",
		invalidSettingValue: "有効な値を入力してください。",
		displayMode: "表示モード",
		displayModeEditorInlineDesc:
			"Markdownファイルのリンクをエディタの下に表示します。Markdown以外のファイルでは表示しません。",
		displayModeSidebarDesc: "すべてのファイルのリンクをサイドバーに表示します。",
		displayModeHybridDesc:
			"Markdownファイルのリンクはエディタの下に表示し、それ以外のファイルではサイドバーに表示します。",
		defaultVisibleLinkCount: "デフォルトの表示リンク数",
		defaultVisibleLinkCountDesc:
			"各セクションにデフォルトで表示するリンク数を設定します。",
		loadMoreLinkIncrement: "追加読み込み時の増分数",
		loadMoreLinkIncrementDesc:
			"「もっと読み込む」をクリックした際に追加で読み込むリンク数を設定します。",
		cardWidth: "カード幅（px）",
		cardWidthDesc: "レスポンシブグリッドで使用するカード幅を設定します。",
		cardHeightRatio: "カード高さ比率",
		cardHeightRatioDesc:
			"実際に描画されるカード幅に対する高さの比率を設定します。例: 1.1 は 高さ = 幅 x 1.1 です。",
		cardGap: "カード間隔（px）",
		cardGapDesc:
			"レスポンシブグリッドでカード間の間隔を設定します。0にすると間隔をなくします。",
		cardMaxColumns: "カードの最大列数",
		cardMaxColumnsDesc: "レスポンシブグリッドで使用する列数の上限を設定します。",
		previewScrollSpeed: "スクロール中のプレビュー表示速度（テキスト/秒）",
		previewScrollSpeedDesc:
			"スクロール中のテキストプレビュー更新数の上限を設定します。使用デバイスの性能に応じて調整してください。",
		sectionMarginBottom: "セクション下余白（px）",
		sectionMarginBottomDesc: "セクション間の下余白を設定します。",
		mergeBacklinkOutgoing: "バックリンクとアウトゴーイングリンクのセクションを統合",
		mergeBacklinkOutgoingDesc:
			"バックリンクとアウトゴーイングリンクを単一の「リンク」セクションに統合します。",
		twoHopHeaderSortOrder: "2ホップリンクヘッダーの並び順",
		twoHopHeaderSortOrderDesc:
			"「2ホップリンク」セクション内のヘッダーの表示順序を設定します。",
		quickSortField1: "固定ソート 1",
		quickSortField2: "固定ソート 2",
		quickSortFieldDesc:
			"ソートメニューの横に表示する項目を選びます。「なし」で空欄になり、同じ項目を2つ選んだ場合は1つだけ表示されます。",
		none: "なし",
		sortRelevance: "関連度",
		sortTitle: "タイトル",
		sortBacklinks: "バックリンク",
		sortCreatedDate: "作成日時",
		sortModifiedDate: "更新日時",
		sortFileSize: "ファイルサイズ",
		hideDuplicateNotes: "重複ノートを非表示",
		hideDuplicateNotesDesc:
			"既に上位セクションに表示されているノートを非表示にします。",
		enableTagFeatures: "タグ機能を有効化",
		enableTagFeaturesDesc:
			"タグ専用ページ、タグ検索の専用表示、タグインデックス作成を有効にします。",
		showTagsSection: "タグセクションを表示",
		showTagsSectionDesc: "現在のノートと同じタグを持つノートを表示します。",
		hideAttachments: "添付ファイルを非表示",
		hideAttachmentsDesc:
			"バックリンクや関連リンクなどの結果から添付ファイルを除外します。",
		highlightUnresolvedLinks: "バックリンクが1つのみの未解決リンクをハイライト",
		highlightUnresolvedLinksDesc:
			"バックリンクが1つのみの未解決リンクの外観を変更します。",
		priorityFrontmatterKeysForImagePreview:
			"画像プレビューに優先使用するプロパティ",
		priorityFrontmatterKeysForImagePreviewDesc:
			"プロパティ名を優先順にカンマ区切りで指定します。有効な画像URLまたは内部画像リンクがある場合、最初に見つかった画像をプレビューに表示します。",
		priorityFrontmatterKeyForPreview: "テキストプレビューに優先使用するプロパティ",
		priorityFrontmatterKeyForPreviewDesc:
			"プロパティ名を優先順にカンマ区切りで指定します。値がある場合、最初に見つかった値をファイルの内容の代わりにテキストプレビューに表示します。",
		priorityFrontmatterKeyForTitle: "カードタイトルに優先使用するプロパティ",
		priorityFrontmatterKeyForTitleDesc:
			"プロパティ名を優先順にカンマ区切りで指定します。値がある場合、最初に見つかった値を通常のタイトルの代わりにカードタイトルとして表示します。",
		interaction: "操作",
		highlightOnOpen: "開く際にハイライト",
		highlightOnOpenDesc:
			"位置情報付きのバックリンクまたは送信リンクを開く際、その位置までスクロールしてハイライトします。",
		highlightInPopoverOnHover: "ホバー時にポップオーバーでハイライト",
		highlightInPopoverOnHoverDesc:
			"カードにホバーした際に表示されるポップオーバー内でリンク位置をハイライトします。",
		openTagSearchDedicatedView: "タグの検索結果を専用ビューで開く",
		openTagSearchDedicatedViewDesc: "タグの一覧をタグ専用ビューで開きます。",
		openUnresolvedNoteView: "未解決リンク作成時にバックリンクを確認",
		openUnresolvedNoteViewDesc:
			"2つ以上のバックリンクを持つ未解決リンクをクリックした際、新しいファイルを作成する前に一時的な作成前ビューを開きます。",
		showAllNotesNewTab: "新しいタブ（空のビュー）ですべてのノートを表示",
		showAllNotesNewTabDesc:
			"有効にすると、空のビューで新しいタブを開く際、すべてのマークダウンノートを無限スクロール付きのカードとして表示します。",
		pinBookmarkedToTopInAllNotes: "ブックマークしたノートを先頭に固定",
		pinBookmarkedToTopInAllNotesDesc:
			"すべてのノートビューで、ブックマークしたノートをリストの先頭に固定します。",
		frontmatterKeyCreationDate: "作成日に使用するプロパティ",
		frontmatterKeyCreationDateDesc:
			"指定した場合、ファイルの作成日の代わりにこのプロパティの値を使用します（例: created）。空の場合、ファイルの作成日を使用します。",
		frontmatterKeyModificationDate: "更新日に使用するプロパティ",
		frontmatterKeyModificationDateDesc:
			"指定した場合、ファイルの更新日の代わりにこのプロパティの値を使用します（例: updated）。空の場合、ファイルの更新日を使用します。",
		belowEditor: "エディタの下",
		sidebar: "サイドバー",
		hybrid: "ハイブリッド",
		appearance: "出現順",
		linkCountAscending: "リンク数（昇順）",
		card: "カード",
	},
};

export function t(key: TranslationKey, lang: Language): string {
	return translations[lang][key];
}
