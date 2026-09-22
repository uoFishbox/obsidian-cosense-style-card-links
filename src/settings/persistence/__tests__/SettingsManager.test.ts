import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_SETTINGS,
	SETTINGS_SCHEMA_VERSION,
	serializePluginSettings,
} from "settings/model";
import { SettingsManager } from "settings/persistence/SettingsManager";

describe("SettingsManager", () => {
	it("migrates legacy flat data to the current storage envelope", async () => {
		const legacySettings = {
			...DEFAULT_SETTINGS,
			settingsSchemaVersion: 2,
			language: "ja",
			lastUsedSortOption: "modified-date",
		};
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn().mockResolvedValue(legacySettings),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);

		await manager.load();

		expect(plugin.settings.language).toBe("ja");
		expect(plugin.settings.lastUsedSortOption).toBe("modified-date");
		expect(plugin.saveData).toHaveBeenCalledWith(
			serializePluginSettings(plugin.settings),
		);
	});

	it("preserves unsupported schema data and disables automatic saving", async () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const storedData = {
			schemaVersion: SETTINGS_SCHEMA_VERSION + 1,
			settings: { language: "ja" },
			preferences: {},
		};
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn().mockResolvedValue(storedData),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);

		await manager.load();
		await manager.update("language", "ja");
		await manager.destroy();

		expect(plugin.saveData).not.toHaveBeenCalled();
		expect(warning).toHaveBeenCalledWith(
			expect.stringContaining("unsupported schema version"),
		);
		warning.mockRestore();
	});

	it("drops obsolete internal tuning settings while loading", async () => {
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn().mockResolvedValue({
				schemaVersion: SETTINGS_SCHEMA_VERSION,
				settings: {
					previewActivationAheadRows: 2.8,
					previewDomCommitsPerSecond: 40.8,
				},
				preferences: {},
			}),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);

		await manager.load();

		expect(plugin.settings).not.toHaveProperty("previewActivationAheadRows");
		expect(plugin.settings).not.toHaveProperty("previewDomCommitsPerSecond");
	});

	it("ignores unknown keys while loading settings", async () => {
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn().mockResolvedValue({
				schemaVersion: SETTINGS_SCHEMA_VERSION,
				settings: { obsoleteSetting: { retained: false } },
				preferences: {},
			}),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);

		await manager.load();

		expect(plugin.settings).not.toHaveProperty("obsoleteSetting");
	});

	it("replaces the authoritative settings object on update", async () => {
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn(),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);
		const previous = plugin.settings;

		await manager.update("language", "ja");
		await manager.destroy();

		expect(plugin.settings).not.toBe(previous);
		expect(plugin.settings.language).toBe("ja");
		expect(plugin.saveData).toHaveBeenCalledWith(
			serializePluginSettings(plugin.settings),
		);
	});
});
