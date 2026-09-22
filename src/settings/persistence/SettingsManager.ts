import {
	DEFAULT_SETTINGS,
	isCurrentPersistedPluginData,
	parsePluginSettings,
	serializePluginSettings,
	type PersistedPluginData,
	type PluginSettings,
} from "settings/model";

const SAVE_DEBOUNCE_DELAY_MS = 100;

interface SettingsPersistenceHost {
	settings: PluginSettings;
	loadData(): Promise<unknown>;
	saveData(data: PersistedPluginData): Promise<void>;
}

export class SettingsManager {
	private saveDebounceTimer: ReturnType<typeof globalThis.setTimeout> | undefined =
		undefined;

	constructor(private plugin: SettingsPersistenceHost) {}

	async load(): Promise<void> {
		try {
			const data = await this.plugin.loadData();
			this.replaceSettings(parsePluginSettings(data));
			if (!isCurrentPersistedPluginData(data)) {
				await this.persistSettings();
			}
		} catch (error) {
			console.error("設定の読み込みに失敗しました:", error);
			this.replaceSettings(DEFAULT_SETTINGS);
			throw error;
		}
	}

	async saveImmediate(): Promise<void> {
		this.cancelScheduledSave();
		await this.persistSettings();
	}

	private scheduleSave(): void {
		this.cancelScheduledSave();

		this.saveDebounceTimer = globalThis.setTimeout(async () => {
			this.saveDebounceTimer = undefined;
			try {
				await this.persistSettings();
			} catch {
				// Debounced persistence has no caller to receive the rejection.
			}
		}, SAVE_DEBOUNCE_DELAY_MS);
	}

	private cancelScheduledSave(): void {
		if (this.saveDebounceTimer === undefined) {
			return;
		}

		globalThis.clearTimeout(this.saveDebounceTimer);
		this.saveDebounceTimer = undefined;
	}

	private async persistSettings(): Promise<void> {
		try {
			await this.plugin.saveData(serializePluginSettings(this.plugin.settings));
		} catch (error) {
			console.error("設定の保存に失敗しました:", error);
			throw error;
		}
	}

	async update<K extends keyof PluginSettings>(
		key: K,
		value: PluginSettings[K],
	): Promise<void> {
		this.replaceSettings({ ...this.plugin.settings, [key]: value });
		this.scheduleSave();
	}

	private replaceSettings(settings: PluginSettings): void {
		this.plugin.settings = Object.freeze({ ...settings });
	}

	async destroy(): Promise<void> {
		if (this.saveDebounceTimer !== undefined) {
			await this.saveImmediate();
		}
	}
}
