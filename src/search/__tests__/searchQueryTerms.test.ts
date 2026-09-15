import { describe, expect, it } from "vitest";
import { getSearchQueryTerms } from "../searchQueryTerms";

describe("getSearchQueryTerms", () => {
	it("keeps a double-quoted phrase as one search term", () => {
		expect(getSearchQueryTerms('"text text2"')).toEqual({
			included: ["text text2"],
			excluded: [],
			includedTags: [],
			excludedTags: [],
		});
	});

	it("combines quoted phrases with unquoted terms", () => {
		expect(getSearchQueryTerms('alpha "Beta Gamma" delta')).toEqual({
			included: ["alpha", "beta gamma", "delta"],
			excluded: [],
			includedTags: [],
			excludedTags: [],
		});
	});

	it("parses excluded terms and excluded quoted phrases", () => {
		expect(getSearchQueryTerms('alpha -beta -"gamma delta"')).toEqual({
			included: ["alpha"],
			excluded: ["beta", "gamma delta"],
			includedTags: [],
			excludedTags: [],
		});
	});

	it("falls back to separate terms after an unmatched quote", () => {
		expect(getSearchQueryTerms('alpha "beta gamma')).toEqual({
			included: ["alpha", "beta", "gamma"],
			excluded: [],
			includedTags: [],
			excludedTags: [],
		});
	});

	it("parses included and excluded hash-prefixed tags separately", () => {
		expect(getSearchQueryTerms("alpha #Project -#Archive #project/sub")).toEqual({
			included: ["alpha"],
			excluded: [],
			includedTags: ["project", "project/sub"],
			excludedTags: ["archive"],
		});
	});
});
