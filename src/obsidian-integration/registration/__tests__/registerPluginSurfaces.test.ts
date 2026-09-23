import { describe, expect, it, vi } from "vitest";
import type { Command } from "obsidian";
import type { PluginHost } from "obsidian-integration/pluginHost";
import type { RegisterPluginSurfacesDeps } from "../registerPluginSurfaces";
import { registerPluginSurfaces } from "../registerPluginSurfaces";
import { TWO_HOP_LINKS_VIEW_TYPE } from "obsidian-integration/views/viewTypes";

vi.mock("settings/ui/SettingTab", () => ({
	CosenseCardLinksSettingTab: class {},
}));
vi.mock("obsidian-integration/markdown/livePreview", () => ({
	buildLivePreviewPlugin: vi.fn(),
}));

type TestLeaf = {
	view: unknown;
	setViewState: ReturnType<typeof vi.fn>;
};

function setup(existing?: TestLeaf, activeFile: unknown = null) {
	const commands: Command[] = [];
	const view = { renderForFile: vi.fn(), clearContent: vi.fn() };
	const leaf: TestLeaf = existing ?? {
		view,
		setViewState: vi.fn().mockResolvedValue(undefined),
	};
	const workspace = {
		getActiveFile: vi.fn().mockReturnValue(activeFile),
		getLeavesOfType: vi.fn().mockReturnValue(existing ? [existing] : []),
		getRightLeaf: vi.fn().mockReturnValue(leaf),
		getLeaf: vi.fn().mockReturnValue(leaf),
		revealLeaf: vi.fn(),
		on: vi.fn(),
	};
	const plugin = {
		app: { workspace },
		settings: { displayMode: "sidebar-view" },
		addSettingTab: vi.fn(),
		registerView: vi.fn(),
		registerHoverLinkSource: vi.fn(),
		addCommand: (command: Command) => commands.push(command),
		registerEditorExtension: vi.fn(),
		registerMarkdownPostProcessor: vi.fn(),
		registerEvent: vi.fn(),
	} as unknown as PluginHost;
	const deps = {
		scrollManager: { toggleScroll: vi.fn() },
		keyboardCardNavigator: { toggle: vi.fn() },
	} as unknown as RegisterPluginSurfacesDeps;
	registerPluginSurfaces(plugin, deps);
	const command = commands.find((item) => item.id === "open-card-links-view");
	if (!command?.callback) throw new Error("Open command was not registered");
	return { command, leaf, view, workspace };
}

describe("open Card links view command", () => {
	it("opens the sidebar and renders the active file", async () => {
		const file = { path: "note.md" };
		const { command, leaf, view, workspace } = setup(undefined, file);
		command.callback?.();
		await vi.waitFor(() => {
			expect(leaf.setViewState).toHaveBeenCalledWith({
				type: TWO_HOP_LINKS_VIEW_TYPE,
				active: true,
			});
			expect(view.renderForFile).toHaveBeenCalledWith(file);
			expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf);
		});
	});

	it("reuses and reveals an existing view without replacing it", async () => {
		const file = { path: "other.md" };
		const view = { renderForFile: vi.fn(), clearContent: vi.fn() };
		const leaf = { view, setViewState: vi.fn() };
		const { command, workspace } = setup(leaf, file);
		command.callback?.();
		await vi.waitFor(() => expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf));
		expect(leaf.setViewState).not.toHaveBeenCalled();
		expect(workspace.getRightLeaf).not.toHaveBeenCalled();
		expect(view.renderForFile).toHaveBeenCalledWith(file);
	});

	it("opens without a file and falls back to a tab when no right leaf is available", async () => {
		const { command, leaf, view, workspace } = setup();
		workspace.getRightLeaf.mockReturnValue(null);
		command.callback?.();
		await vi.waitFor(() => expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf));
		expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
		expect(view.renderForFile).not.toHaveBeenCalled();
	});
});
