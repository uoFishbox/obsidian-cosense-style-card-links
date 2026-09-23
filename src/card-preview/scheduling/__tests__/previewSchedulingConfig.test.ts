import { describe, expect, it } from "vitest";
import {
	DEFAULT_PREVIEW_DOM_COMMITS_PER_SECOND,
	resolvePreviewImageDomCommitsPerSecond,
} from "../previewSchedulingConfig";

describe("preview DOM commit rates", () => {
	it("keeps the current 96:20 text-to-image ratio", () => {
		expect(DEFAULT_PREVIEW_DOM_COMMITS_PER_SECOND).toBe(96);
		expect(resolvePreviewImageDomCommitsPerSecond(96)).toBe(20);
		expect(resolvePreviewImageDomCommitsPerSecond(48)).toBe(10);
	});

	it("keeps the image limit stricter even at low text rates", () => {
		expect(resolvePreviewImageDomCommitsPerSecond(1)).toBeLessThan(1);
	});

	it("uses the default rate for invalid text limits", () => {
		expect(resolvePreviewImageDomCommitsPerSecond(0)).toBe(20);
		expect(resolvePreviewImageDomCommitsPerSecond(Number.NaN)).toBe(20);
	});
});
