import { describe, test, expect } from "vitest";
import { getBranchUsageKey, getLinkUsageKey } from "../usageKeys";
import type { CardLinkBranch } from "cards/model";
import type { IndexedLink } from "indexing/model";
import { type TFile } from "obsidian";

vi.mock("obsidian", () => ({
	normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
}));

describe("keyGenerator - empty text key fallback", () => {
	describe("when rawText is empty or whitespace-only for unresolved links", () => {
		test("empty text links from different source files produce different keys", () => {
			const branch1: CardLinkBranch = {
				hop1: {
					rawText: "",
					path: undefined,
					isUnresolved: true,
					sourceFile: { path: "source1.md" } as TFile,
				},
				hop2: [],
			};

			const branch2: CardLinkBranch = {
				hop1: {
					rawText: "   ",
					path: undefined,
					isUnresolved: true,
					sourceFile: { path: "source2.md" } as TFile,
				},
				hop2: [],
			};

			expect(getBranchUsageKey(branch1)).toBe("f:source1.md");
			expect(getBranchUsageKey(branch2)).toBe("f:source2.md");
			expect(getBranchUsageKey(branch1)).not.toBe(getBranchUsageKey(branch2));
		});

		test("falls back to 't:' when text is empty and sourceFile.path is absent", () => {
			const branch: CardLinkBranch = {
				hop1: {
					rawText: "",
					path: undefined,
					isUnresolved: true,
					sourceFile: { path: undefined } as unknown as TFile,
				},
				hop2: [],
			};

			expect(getBranchUsageKey(branch)).toBe("t:");
		});
	});

	describe("empty IndexedLink fallback", () => {
		test("uses an empty text key when source path and text are absent", () => {
			const link: IndexedLink = {
				rawText: "",
				path: undefined,
				displayText: undefined,
				isUnresolved: true,
				sourceFile: { path: undefined } as unknown as TFile,
			};

			expect(getLinkUsageKey(link)).toBe("t:");
		});
	});
});
