import type { Platform } from "obsidian";

export interface PreCreationFilenamePolicy {
	/** Characters that cannot appear in a file name on the current OS. */
	readonly forbiddenCharacters: string;
	/** Accepts vault paths: / separates folders rather than being a file-name character. */
	hasInvalidCharacter(path: string): boolean;
}

type FilenamePlatform = Pick<
	typeof Platform,
	"isWin" | "isAndroidApp" | "isMacOS" | "isIosApp" | "isLinux"
>;

const COMMON_INVALID = /[\\:#^|\[\]]/u;
const WINDOWS_ANDROID_INVALID = /[\\:*?"<>#^|\[\]]/u;
const COMMON_CHARACTERS = "\\ / : # ^ [ ] |";
const WINDOWS_ANDROID_CHARACTERS = '\\ / : * ? " < > # ^ [ ] |';

/** Select the file-name restrictions of the current Obsidian host OS. */
export function getPreCreationFilenamePolicy(
	platform: FilenamePlatform,
): PreCreationFilenamePolicy {
	// On unknown hosts, use the stricter policy rather than attempting a file that may fail.
	const isWindowsOrAndroid =
		platform.isWin ||
		platform.isAndroidApp ||
		!(platform.isMacOS || platform.isIosApp || platform.isLinux);
	const pattern = isWindowsOrAndroid ? WINDOWS_ANDROID_INVALID : COMMON_INVALID;
	return {
		forbiddenCharacters: isWindowsOrAndroid
			? WINDOWS_ANDROID_CHARACTERS
			: COMMON_CHARACTERS,
		hasInvalidCharacter: (path) => pattern.test(path),
	};
}
