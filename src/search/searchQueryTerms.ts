const REGEXP_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;
const WIKILINK_DELIMITER_PATTERN = "(?:\\[\\[|\\]\\])*";
const SEARCH_TERM_PATTERN = /(-?)"([^"]+)"|[^\s"]+/gu;

export interface SearchQueryTerms {
	readonly included: readonly string[];
	readonly excluded: readonly string[];
}

/** Parses included and `-`-prefixed excluded terms from a search query. */
export function getSearchQueryTerms(query: string | undefined): SearchQueryTerms {
	const normalizedQuery = query?.trim().toLowerCase() ?? "";
	if (!normalizedQuery) {
		return { included: [], excluded: [] };
	}

	const included: string[] = [];
	const excluded: string[] = [];
	for (const match of normalizedQuery.matchAll(SEARCH_TERM_PATTERN)) {
		const quotedTerm = match[2];
		const rawTerm = quotedTerm ?? match[0];
		const isExcluded =
			match[1] === "-" ||
			(quotedTerm === undefined && rawTerm.length > 1 && rawTerm.startsWith("-"));
		const term =
			isExcluded && quotedTerm === undefined ? rawTerm.slice(1) : rawTerm;
		const destination = isExcluded ? excluded : included;
		if (term && !destination.includes(term)) destination.push(term);
	}
	return { included, excluded };
}

/** Builds a literal RegExp source that treats WikiLink delimiters as invisible. */
export function buildWikiLinkInsensitiveLiteralSource(term: string): string {
	return Array.from(term, (character) =>
		character.replace(REGEXP_ESCAPE_PATTERN, "\\$&"),
	).join(WIKILINK_DELIMITER_PATTERN);
}
