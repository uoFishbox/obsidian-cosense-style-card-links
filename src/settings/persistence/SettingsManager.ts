import { Notice } from "obsidian";
import {
	DEFAULT_SETTINGS,
	loadPluginSettings,
	serializePluginSettings,
	type PersistedPluginData,
	type PluginSettings,
	type PluginSettingsLoadResult,
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
	private persistenceBlocked = false;

	constructor(private plugin: SettingsPersistenceHost) {}

	async load(): Promise<void> {
		try {
			const result = loadPluginSettings(await this.plugin.loadData());
			this.replaceSettings(result.settings);
			const persistenceBlocked = isUnsafeToOverwrite(result);
			this.persistenceBlocked = persistenceBlocked;

			if (persistenceBlocked) {
				showSettingsLoadWarning(result);
				return;
			}
			if (result.status === "migrated" || result.status === "missing") {
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
		if (this.persistenceBlocked) {
			return;
		}

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
		if (this.persistenceBlocked) {
			return;
		}

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

type UnsafePluginSettingsLoadResult = Extract<
	PluginSettingsLoadResult,
	{ status: "invalid" | "unsupported-schema" }
>;

function isUnsafeToOverwrite(
	result: PluginSettingsLoadResult,
): result is UnsafePluginSettingsLoadResult {
	return result.status === "invalid" || result.status === "unsupported-schema";
}

function showSettingsLoadWarning(result: UnsafePluginSettingsLoadResult): void {
	const detail =
		result.status === "unsupported-schema"
			? `unsupported schema version (${formatStoredVersion(result.storedVersion)})`
			: "invalid data";
	const message =
		`Cosense-style card links: Settings contain ${detail}. ` +
		"The original data was preserved and automatic settings saving was disabled.";

	console.warn(message);
	new Notice(message, 10_000);
}

function formatStoredVersion(version: unknown): string {
	if (typeof version === "number" || typeof version === "string") {
		return String(version);
	}
	return "unknown";
}
