import { describe, expect, it } from "vitest";
import { getPreCreationFilenamePolicy } from "../preCreationFilenamePolicy";

type PlatformFlags = Parameters<typeof getPreCreationFilenamePolicy>[0];

function platformWith(flag?: keyof PlatformFlags): PlatformFlags {
	return {
		isWin: flag === "isWin",
		isAndroidApp: flag === "isAndroidApp",
		isMacOS: flag === "isMacOS",
		isIosApp: flag === "isIosApp",
		isLinux: flag === "isLinux",
	};
}

describe("pre-creation file-name policy", () => {
	it.each(["isWin", "isAndroidApp"] as const)(
		"rejects OS-specific and common characters on %s",
		(flag) => {
			const policy = getPreCreationFilenamePolicy(platformWith(flag));
			for (const character of [
				"*",
				'"',
				"\\",
				":",
				"?",
				"<",
				">",
				"#",
				"^",
				"[",
				"]",
				"|",
			]) {
				expect(policy.hasInvalidCharacter(`note${character}.md`)).toBe(true);
			}
			expect(policy.forbiddenCharacters).toContain("* ?");
		},
	);

	it.each(["isMacOS", "isIosApp", "isLinux"] as const)(
		"allows Windows-only characters but rejects common characters on %s",
		(flag) => {
			const policy = getPreCreationFilenamePolicy(platformWith(flag));
			for (const character of ["*", '"', "?", "<", ">"]) {
				expect(policy.hasInvalidCharacter(`note${character}.md`)).toBe(false);
			}
			for (const character of ["\\", ":", "#", "^", "[", "]", "|"]) {
				expect(policy.hasInvalidCharacter(`note${character}.md`)).toBe(true);
			}
			expect(policy.forbiddenCharacters).toBe("\\ / : # ^ [ ] |");
		},
	);

	it("treats slashes as vault folder separators on every OS", () => {
		for (const flag of [
			"isWin",
			"isAndroidApp",
			"isMacOS",
			"isIosApp",
			"isLinux",
		] as const) {
			expect(
				getPreCreationFilenamePolicy(platformWith(flag)).hasInvalidCharacter(
					"folder/note.md",
				),
			).toBe(false);
		}
	});

	it("uses the stricter rules on an unknown OS", () => {
		expect(
			getPreCreationFilenamePolicy(platformWith()).hasInvalidCharacter(
				"note?.md",
			),
		).toBe(true);
	});
});
