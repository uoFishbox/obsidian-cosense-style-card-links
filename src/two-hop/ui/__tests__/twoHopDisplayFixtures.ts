import type { TFile } from "obsidian";
import type { IndexedLink, TaggedNote } from "indexing/model";
import type { DisplayData } from "two-hop/display/displayDataBuilder";
import { createMockTFile } from "testing/__mocks__/testHelpers";

/** Creates a resolved backlink used by two-hop UI tests. */
export function createBacklink(
	sourceFile: TFile,
	rawText = sourceFile.basename,
): IndexedLink {
	return {
		sourceFile,
		rawText,
		path: sourceFile.path,
		isUnresolved: false,
		backlinkCount: 0,
	};
}

/** Creates a tagged note with one common tag. */
export function createTaggedNote(file: TFile, tag = "alpha"): TaggedNote {
	return {
		file,
		commonTags: [tag],
		path: file.path,
	};
}

/** Creates empty display data with only the supplied fields populated. */
export function createDisplayData(partial: Partial<DisplayData> = {}): DisplayData {
	return {
		outgoing: [],
		backlinks: [],
		mergedItems: [],
		twoHopBranches: [],
		tagGroups: [],
		newLinks: [],
		...partial,
	};
}

/** Collects files exposed through display data for mock file resolution. */
export function collectDisplayFiles(
	displayData: DisplayData,
	initialFiles: readonly TFile[] = [],
): Map<string, TFile> {
	const files = new Map(initialFiles.map((file) => [file.path, file]));
	const addFile = (file: TFile | null | undefined) => {
		if (file) files.set(file.path, file);
	};

	for (const branch of displayData.outgoing) {
		if (branch.hop1.path) addFile(createMockTFile(branch.hop1.path));
	}
	for (const link of displayData.backlinks) {
		addFile(link.sourceFile);
	}
	for (const item of displayData.mergedItems) {
		if ("hop1" in item && item.hop1.path) {
			addFile(createMockTFile(item.hop1.path));
		}
		if ("sourceFile" in item) addFile(item.sourceFile);
	}
	for (const branch of displayData.twoHopBranches) {
		if (branch.hop1.path) addFile(createMockTFile(branch.hop1.path));
		for (const link of branch.hop2) addFile(link.sourceFile);
	}
	for (const section of displayData.tagGroups) {
		for (const note of section.notes) addFile(note.file);
	}

	return files;
}
