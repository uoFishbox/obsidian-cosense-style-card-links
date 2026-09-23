import type { PluginSettings } from "settings/model";
import type { TranslationKey } from "../translations";

export type SectionId =
	| "general"
	| "cards"
	| "results"
	| "interaction"
	| "tags"
	| "unresolvedLinks"
	| "canvas"
	| "newTab"
	| "advanced";

type KeysOfType<Value> = {
	[K in keyof PluginSettings]-?: PluginSettings[K] extends Value ? K : never;
}[keyof PluginSettings];

type BooleanSettingKey = KeysOfType<boolean>;
type StringSettingKey = KeysOfType<string>;
type TextSettingKey = KeysOfType<string | number>;
type NumberSettingKey = KeysOfType<number>;

type SettingOption<Value extends string = string> = {
	value: Value;
	label: string;
	isTranslationKey?: false;
};

type TranslatedSettingOption<Value extends string = string> = {
	value: Value;
	label: TranslationKey;
	isTranslationKey: true;
};

export type SelectOption<Value extends string = string> =
	| SettingOption<Value>
	| TranslatedSettingOption<Value>;

interface BaseSettingDefinition<K extends keyof PluginSettings> {
	section: SectionId;
	settingKey: K;
	controlType: "toggle" | "dropdown" | "text" | "textarea" | "slider";
	translationKey: TranslationKey;
	descriptionKey: TranslationKey | ((settings: PluginSettings) => TranslationKey);
	desktopOnly?: boolean;
	disabled?: (settings: PluginSettings) => boolean;
	refreshOnChange?: boolean;
}

interface ToggleSettingDefinition<
	K extends BooleanSettingKey,
> extends BaseSettingDefinition<K> {
	controlType: "toggle";
}

interface DropdownSettingDefinition<
	K extends StringSettingKey,
> extends BaseSettingDefinition<K> {
	controlType: "dropdown";
	options: ReadonlyArray<SelectOption<PluginSettings[K]>>;
}

interface StringSettingDefinition<
	K extends keyof PluginSettings,
> extends BaseSettingDefinition<K> {
	placeholder?: string;
	parse: (value: string, settings: PluginSettings) => PluginSettings[K] | undefined;
	format?: (value: PluginSettings[K]) => string;
}

interface TextSettingDefinition<
	K extends TextSettingKey,
> extends StringSettingDefinition<K> {
	controlType: "text";
}

interface TextareaSettingDefinition<
	K extends StringSettingKey,
> extends StringSettingDefinition<K> {
	controlType: "textarea";
	rows?: number;
}

interface SliderSettingDefinition<
	K extends NumberSettingKey,
> extends BaseSettingDefinition<K> {
	controlType: "slider";
	min: number;
	max: number;
	step: number;
}

export type SettingDefinition =
	| ToggleSettingDefinition<BooleanSettingKey>
	| DropdownSettingDefinition<StringSettingKey>
	| TextSettingDefinition<TextSettingKey>
	| TextareaSettingDefinition<StringSettingKey>
	| SliderSettingDefinition<NumberSettingKey>;

export function defineDropdown<K extends StringSettingKey>(
	definition: Omit<DropdownSettingDefinition<K>, "controlType">,
): DropdownSettingDefinition<K> {
	return { ...definition, controlType: "dropdown" };
}

export const SECTION_ORDER: ReadonlyArray<{
	id: SectionId;
	titleKey?: TranslationKey;
}> = [
	{ id: "general", titleKey: "general" },
	{ id: "cards", titleKey: "card" },
	{ id: "results", titleKey: "resultsAndSorting" },
	{ id: "interaction", titleKey: "interaction" },
	{ id: "tags", titleKey: "sectionTags" },
	{ id: "unresolvedLinks", titleKey: "sectionUnresolvedLinks" },
	{ id: "canvas", titleKey: "sectionCanvas" },
	{ id: "newTab", titleKey: "sectionNewTab" },
	{ id: "advanced", titleKey: "advanced" },
];

export const parsePositiveInteger = (value: string): number | undefined => {
	const num = Number(value.trim());
	if (!Number.isInteger(num) || num <= 0) {
		return undefined;
	}
	return num;
};

export const parseNonNegativeInteger = (value: string): number | undefined => {
	const num = Number(value.trim());
	if (!Number.isInteger(num) || num < 0) {
		return undefined;
	}
	return num;
};

export const parsePositiveNumber = (value: string): number | undefined => {
	const num = Number(value.trim());
	if (!Number.isFinite(num) || num <= 0) {
		return undefined;
	}
	return num;
};

export const parseTrimmedString = (value: string): string => value.trim();
