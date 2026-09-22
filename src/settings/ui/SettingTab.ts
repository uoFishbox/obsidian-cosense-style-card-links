import { Platform, PluginSettingTab } from "obsidian";
import type {
	App,
	Setting,
	SettingDefinitionItem as ObsidianSettingDefinitionItem,
	SettingGroupItem,
} from "obsidian";
import type { PluginHost } from "obsidian-integration/pluginHost";
import type { Language, PluginSettings } from "settings/model";
import {
	SECTION_ORDER,
	type SelectOption,
	type SettingDefinition,
} from "./sections/settingDefinition";
import { DISPLAY_SETTING_DEFINITIONS } from "./sections/displaySettings";
import { INTERACTION_SETTING_DEFINITIONS } from "./sections/interactionSettings";
import { PREVIEW_SETTING_DEFINITIONS } from "./sections/previewSettings";
import { t } from "./translations";

const SETTING_DEFINITIONS: ReadonlyArray<SettingDefinition> = [
	...DISPLAY_SETTING_DEFINITIONS,
	...PREVIEW_SETTING_DEFINITIONS,
	...INTERACTION_SETTING_DEFINITIONS,
];

function getOptionLabel(option: SelectOption, lang: Language): string {
	if (option.isTranslationKey) {
		return t(option.label, lang);
	}
	return option.label;
}

function getDescription(
	definition: SettingDefinition,
	settings: PluginSettings,
	lang: Language,
): string {
	const key =
		typeof definition.descriptionKey === "function"
			? definition.descriptionKey(settings)
			: definition.descriptionKey;
	return t(key, lang);
}

function reportSettingUpdateError(error: unknown): void {
	console.error("設定の更新に失敗しました:", error);
}

export class CosenseCardLinksSettingTab extends PluginSettingTab {
	private readonly pluginInstance: PluginHost;

	constructor(app: App, plugin: PluginHost) {
		super(app, plugin);
		this.pluginInstance = plugin;
	}

	getSettingDefinitions(): ObsidianSettingDefinitionItem[] {
		const settings = this.pluginInstance.settings;
		const lang = settings.language;
		const items: ObsidianSettingDefinitionItem[] = [];

		for (const section of SECTION_ORDER) {
			const sectionSettings = SETTING_DEFINITIONS.filter(
				(definition) =>
					definition.section === section.id &&
					(!definition.desktopOnly || Platform.isDesktopApp),
			);
			if (sectionSettings.length === 0) {
				continue;
			}

			const settingItems = sectionSettings.map(
				(definition): SettingGroupItem => ({
					name: t(definition.translationKey, lang),
					desc: getDescription(definition, settings, lang),
					render: (setting) => this.renderControl(setting, definition, lang),
				}),
			);

			if (!section.titleKey) {
				items.push(...settingItems);
				continue;
			}

			items.push({
				type: "group",
				heading: t(section.titleKey, lang),
				items: settingItems,
			});
		}

		return items;
	}

	private renderControl(
		setting: Setting,
		definition: SettingDefinition,
		lang: Language,
	): void {
		const currentSettings = this.pluginInstance.settings;
		const currentValue = currentSettings[definition.settingKey];
		setting.setDisabled(definition.disabled?.(currentSettings) ?? false);

		switch (definition.controlType) {
			case "toggle":
				setting.addToggle((toggle) =>
					toggle.setValue(Boolean(currentValue)).onChange((value) => {
						void this.pluginInstance
							.updateSetting(
								definition.settingKey,
								value as PluginSettings[typeof definition.settingKey],
							)
							.then(() => {
								if (definition.refreshOnChange) this.update();
							})
							.catch(reportSettingUpdateError);
					}),
				);
				return;
			case "dropdown":
				setting.addDropdown((dropdown) => {
					for (const option of definition.options) {
						dropdown.addOption(option.value, getOptionLabel(option, lang));
					}
					dropdown.setValue(String(currentValue)).onChange((value) => {
						void this.pluginInstance
							.updateSetting(
								definition.settingKey,
								value as PluginSettings[typeof definition.settingKey],
							)
							.then(() => {
								if (
									definition.settingKey === "language" ||
									definition.refreshOnChange
								) {
									this.update();
								}
							})
							.catch(reportSettingUpdateError);
					});
				});
				return;
			case "text":
				setting.addText((text) =>
					text
						.setPlaceholder(definition.placeholder ?? "")
						.setValue(
							definition.format
								? definition.format(
										currentValue as PluginSettings[typeof definition.settingKey],
									)
								: String(currentValue ?? ""),
						)
						.onChange((value) => {
							const parsed = definition.parse(value, currentSettings);
							if (parsed === undefined) {
								text.inputEl.setCustomValidity(
									t("invalidSettingValue", lang),
								);
								return;
							}
							text.inputEl.setCustomValidity("");
							void this.pluginInstance
								.updateSetting(definition.settingKey, parsed)
								.catch(reportSettingUpdateError);
						}),
				);
				return;
			case "textarea":
				setting.addTextArea((text) =>
					text
						.setPlaceholder(definition.placeholder ?? "")
						.setValue(
							definition.format
								? definition.format(
										currentValue as PluginSettings[typeof definition.settingKey],
									)
								: String(currentValue ?? ""),
						)
						.onChange((value) => {
							const parsed = definition.parse(value, currentSettings);
							if (parsed === undefined) {
								text.inputEl.setCustomValidity(
									t("invalidSettingValue", lang),
								);
								return;
							}
							text.inputEl.setCustomValidity("");
							void this.pluginInstance
								.updateSetting(definition.settingKey, parsed)
								.catch(reportSettingUpdateError);
						})
						.then((component) => {
							component.inputEl.rows = definition.rows ?? 8;
							component.inputEl.spellcheck = false;
						}),
				);
				return;
		}
	}
}
