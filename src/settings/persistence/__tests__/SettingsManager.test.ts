import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_SETTINGS,
	SETTINGS_SCHEMA_VERSION,
	serializePluginSettings,
} from "settings/model";
import { SettingsManager } from "settings/persistence/SettingsManager";

describe("SettingsManager", () => {
	it("replaces legacy flat data with the current storage envelope", async () => {
		const plugin = {
			settings: { ...DEFAULT_SETTINGS },
			loadData: vi.fn().mockResolvedValue({ language: "ja" }),
			saveData: vi.fn(),
		};
		const manager = new SettingsManager(plugin);

		await manager.load();

		expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		expect(plugin.saveData).toHaveBeenCalledWith(
			serializePluginSettings(DEFAULT_SETTINGS),
		);
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
