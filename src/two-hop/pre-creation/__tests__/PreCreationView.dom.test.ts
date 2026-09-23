import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/svelte";
import { PreCreationView } from "../PreCreationView";

const { renameLinks, showNotice, platformFlags, shortcutHandlers } = vi.hoisted(() => ({
	renameLinks: vi.fn(async () => ({
		filesUpdated: 1,
		linksUpdated: 2,
		failed: [] as { path: string; reason: string }[],
	})),
	showNotice: vi.fn(),
	shortcutHandlers: new Map<string, () => boolean | void>(),
	platformFlags: {
		isWin: true,
		isAndroidApp: false,
		isMacOS: false,
		isIosApp: false,
		isLinux: false,
	},
}));

vi.mock("../preCreationLinkRename", () => ({
	renamePreCreationUnresolvedLinks: renameLinks,
}));

vi.mock("obsidian-integration/files/resolveExpectedPath", () => ({
	resolveExpectedPath: (_app: unknown, linktext: string) => `${linktext}.md`,
}));

function withDomHelpers<T extends HTMLElement>(element: T): T {
	const extended = element as T & {
		empty: () => void;
		createDiv: (options?: { cls?: string }) => HTMLDivElement;
		createEl: (
			tag: string,
			options?: { cls?: string; text?: string },
		) => HTMLElement;
	};
	extended.empty = () => element.replaceChildren();
	extended.createDiv = ((options?: { cls?: string }) => {
		const child = withDomHelpers(document.createElement("div"));
		child.className = options?.cls ?? "";
		element.appendChild(child);
		return child;
	}) as typeof extended.createDiv;
	extended.createEl = ((tag: string, options?: { cls?: string; text?: string }) => {
		const child = withDomHelpers(document.createElement(tag));
		child.className = options?.cls ?? "";
		child.textContent = options?.text ?? "";
		element.appendChild(child);
		return child;
	}) as typeof extended.createEl;
	return element;
}

vi.mock("obsidian", () => {
	class ItemView {
		app: unknown;
		leaf: { app: unknown };
		contentEl: HTMLDivElement;
		constructor(leaf: { app: unknown }) {
			this.leaf = leaf;
			this.app = leaf.app;
			this.contentEl = withDomHelpers(document.createElement("div"));
			document.body.appendChild(this.contentEl);
		}
		async setState(): Promise<void> {}
		getState(): Record<string, unknown> {
			return {};
		}
	}
	return {
		ItemView,
		Platform: platformFlags,
		TFile: class {},
		TFolder: class {},
		Notice: class {
			constructor(message: string) {
				showNotice(message);
			}
		},
		Modal: class {
			contentEl = withDomHelpers(document.createElement("div"));
			private container = document.createElement("div");
			constructor(_app: unknown) {
				this.container.className = "modal";
				this.container.appendChild(this.contentEl);
			}
			setTitle(title: string) {
				this.container.prepend(
					Object.assign(document.createElement("h2"), { textContent: title }),
				);
			}
			setContent(content: string) {
				this.contentEl.textContent = content;
			}
			open() {
				document.body.appendChild(this.container);
			}
			close() {
				this.container.remove();
			}
		},
		Scope: class {
			register(_modifiers: string[], key: string, handler: () => boolean | void) {
				shortcutHandlers.set(key, handler);
				return key;
			}
			unregister(key: string) {
				shortcutHandlers.delete(key);
			}
		},
		getLinkpath: (linktext: string) => linktext,
	};
});

vi.mock("cards/list/ui/TagNotesListHost.svelte", () => ({ default: {} }));

afterEach(() => {
	document.body.replaceChildren();
	renameLinks.mockClear();
	showNotice.mockClear();
	shortcutHandlers.clear();
	Object.assign(platformFlags, {
		isWin: true,
		isAndroidApp: false,
		isMacOS: false,
		isIosApp: false,
		isLinux: false,
	});
	vi.restoreAllMocks();
});

function createViewForFileCreation(linktext: string, creationPath?: string) {
	let ephemeralState: Record<string, unknown> = {};
	const create = vi.fn(async (path: string) => ({ path }));
	const createFolder = vi.fn(async () => {});
	const deleteFile = vi.fn(async () => {});
	const renameFile = vi.fn(async () => {});
	const awaitIdle = vi.fn(async () => {});
	const openFile = vi.fn(async () => {});
	const leaf = {
		app: {
			vault: {
				create,
				createFolder,
				delete: deleteFile,
				getAbstractFileByPath: () => null,
			},
			fileManager: { renameFile },
		},
		getEphemeralState: () => ephemeralState,
		setEphemeralState: (state: Record<string, unknown>) => {
			ephemeralState = state;
		},
		updateHeader: vi.fn(),
		openFile,
		view: null as unknown,
	};
	const plugin = {
		settings: { language: "en", displayMode: "editor-inline" },
		indexingService: {
			isReady: () => false,
			awaitIdle,
			onDataUpdate: () => () => {},
		},
		indexUpdateQueue: {},
	};
	const view = new PreCreationView(
		leaf as unknown as ConstructorParameters<typeof PreCreationView>[0],
		plugin as unknown as ConstructorParameters<typeof PreCreationView>[1],
		{} as ConstructorParameters<typeof PreCreationView>[2],
	);
	leaf.view = view;
	return {
		view,
		create,
		createFolder,
		deleteFile,
		renameFile,
		awaitIdle,
		openFile,
		setState: () =>
			view.setState(
				{
					linktext,
					sourcePath: "source.md",
					expectedPath: `${linktext}.md`,
					creationPath,
				},
				{ history: false },
			),
	};
}

describe("PreCreationView file name validation", () => {
	it("keeps the validated destination fixed and ignores title input during file creation", async () => {
		const { setState, create, renameFile, awaitIdle, view } =
			createViewForFileCreation("New", "Original.md");
		let releaseIndex!: () => void;
		awaitIdle.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					releaseIndex = resolve;
				}),
		);
		await setState();
		const title = document.querySelector<HTMLDivElement>(".inline-title")!;
		document
			.querySelector<HTMLButtonElement>(".ccl-pre-create-actions button")
			?.click();
		await waitFor(() => expect(create).toHaveBeenCalledWith("Original.md", ""));
		expect(title.contentEditable).toBe("false");
		title.textContent = "Unvalidated?Name";
		title.dispatchEvent(new Event("input"));
		expect(view.getState().expectedPath).toBe("New.md");
		releaseIndex();
		await waitFor(() =>
			expect(renameFile).toHaveBeenCalledWith({ path: "Original.md" }, "New.md"),
		);
	});

	it.each(["*", '"', "\\", ":", "?", "<", ">", "#", "^", "[", "]", "|"])(
		"shows a rename modal and does not create a file for %s",
		async (character) => {
			const { setState, create, createFolder, openFile } =
				createViewForFileCreation(`Bad${character}Name`);
			await setState();
			document
				.querySelector<HTMLButtonElement>(".ccl-pre-create-actions button")
				?.click();
			expect(document.querySelector(".modal h2")?.textContent).toBe(
				"Invalid file name",
			);
			expect(document.querySelector(".modal p")?.textContent).toBe(
				'The file name contains characters that cannot be used in Obsidian (\\ / : * ? " < > # ^ [ ] |).',
			);
			expect(document.querySelector(".modal p code")?.textContent).toBe(
				'\\ / : * ? " < > # ^ [ ] |',
			);
			expect(
				document.querySelector(".modal .modal-button-container button")
					?.textContent,
			).toBe("Rename title");
			expect(create).not.toHaveBeenCalled();
			expect(createFolder).not.toHaveBeenCalled();
			expect(openFile).not.toHaveBeenCalled();
			const title = document.querySelector<HTMLElement>(".inline-title");
			const focus = vi.spyOn(title!, "focus");
			document.querySelector<HTMLButtonElement>(".modal button")?.click();
			expect(focus).toHaveBeenCalled();
			expect(document.querySelector(".modal")).toBeNull();
		},
	);

	it("allows Windows-only characters on macOS and shows the macOS list for invalid names", async () => {
		platformFlags.isWin = false;
		platformFlags.isMacOS = true;
		const valid = createViewForFileCreation("Has?Question");
		await valid.setState();
		document
			.querySelector<HTMLButtonElement>(".ccl-pre-create-actions button")
			?.click();
		await waitFor(() =>
			expect(valid.create).toHaveBeenCalledWith("Has?Question.md", ""),
		);
		expect(document.querySelector(".modal")).toBeNull();

		const invalid = createViewForFileCreation("Bad#Name");
		await invalid.setState();
		document
			.querySelectorAll<HTMLButtonElement>(".ccl-pre-create-actions button")
			.item(1)
			?.click();
		expect(document.querySelector(".modal p code")?.textContent).toBe(
			"\\ / : # ^ [ ] |",
		);
		expect(document.querySelector(".modal p")?.textContent).not.toContain("* ?");
		expect(invalid.create).not.toHaveBeenCalled();
	});

	it("allows folder separators in a valid vault path", async () => {
		const { setState, create, createFolder, openFile } =
			createViewForFileCreation("folder/Valid");
		await setState();
		document
			.querySelector<HTMLButtonElement>(".ccl-pre-create-actions button")
			?.click();
		await waitFor(() => expect(create).toHaveBeenCalledWith("folder/Valid.md", ""));
		expect(createFolder).toHaveBeenCalledWith("folder");
		expect(openFile).toHaveBeenCalled();
	});

	it("creates at the renamed path if the original path is invalid", async () => {
		const { setState, create, renameFile } = createViewForFileCreation(
			"Valid",
			"Bad?.md",
		);
		await setState();
		document
			.querySelector<HTMLButtonElement>(".ccl-pre-create-actions button")
			?.click();
		await waitFor(() => expect(create).toHaveBeenCalledWith("Valid.md", ""));
		expect(renameFile).not.toHaveBeenCalled();
	});
});

describe("PreCreationView title rename", () => {
	it("restores the old title on partial failure so failed backlinks can be retried", async () => {
		renameLinks.mockResolvedValueOnce({
			filesUpdated: 1,
			linksUpdated: 1,
			failed: [{ path: "failed.md", reason: "write failed" }],
		});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const { view, setState } = createViewForFileCreation("Old", "Old.md");
		await setState();
		const firstTitle = document.querySelector<HTMLDivElement>(".inline-title")!;
		firstTitle.focus();
		firstTitle.textContent = "New";
		firstTitle.dispatchEvent(new Event("input"));
		firstTitle.blur();

		await waitFor(() => expect(renameLinks).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(view.getState().linktext).toBe("Old"));
		expect(view.getState().creationPath).toBe("Old.md");
		expect(document.querySelector(".inline-title")?.textContent).toBe("Old");

		const retryTitle = document.querySelector<HTMLDivElement>(".inline-title")!;
		retryTitle.focus();
		retryTitle.textContent = "New";
		retryTitle.dispatchEvent(new Event("input"));
		retryTitle.blur();
		await waitFor(() => expect(renameLinks).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(view.getState().creationPath).toBe("New.md"));
		expect(renameLinks.mock.calls[1]?.slice(-2)).toEqual(["Old", "New"]);
	});

	it("focuses and selects the entire current title with F2, then unregisters on close", async () => {
		const { view, setState } = createViewForFileCreation("folder/Original");
		await setState();
		// Register the shortcut in the view scope, then edit after a re-render.
		await view.onOpen();
		await view.setState(
			{
				linktext: "folder/NewTitle",
				sourcePath: "source.md",
				expectedPath: "folder/NewTitle.md",
			},
			{ history: false },
		);

		const title = document.querySelector<HTMLDivElement>(".inline-title");
		expect(title?.textContent).toBe("NewTitle");
		expect(shortcutHandlers.get("F2")?.()).toBe(false);
		expect(document.activeElement).toBe(title);
		const selection = document.getSelection();
		expect(selection?.toString()).toBe("NewTitle");
		expect(selection?.getRangeAt(0).startContainer).toBe(title);
		expect(selection?.getRangeAt(0).endContainer).toBe(title);

		await view.onClose();
		expect(shortcutHandlers.has("F2")).toBe(false);
	});

	it.each([
		{ offset: 0, failed: false },
		{ offset: 3, failed: false },
		{ offset: 7, failed: false },
		{ offset: 3, failed: true },
	])(
		"commits Enter at offset $offset (partial failure: $failed)",
		async ({ offset, failed }) => {
			if (failed) {
				renameLinks.mockResolvedValueOnce({
					filesUpdated: 1,
					linksUpdated: 2,
					failed: [{ path: "source.md", reason: "write failed" }],
				});
				vi.spyOn(console, "warn").mockImplementation(() => {});
			}
			let ephemeralState: Record<string, unknown> = {};
			const leaf = {
				app: {},
				getEphemeralState: () => ephemeralState,
				setEphemeralState: (state: Record<string, unknown>) => {
					ephemeralState = state;
				},
				updateHeader: vi.fn(),
				view: null as unknown,
			};
			const plugin = {
				settings: {
					language: "en",
					displayMode: "editor-inline",
					experimentalCosenseTitleEditing: true,
				},
				indexingService: { isReady: () => false },
				indexUpdateQueue: {},
			};
			const view = new PreCreationView(
				leaf as unknown as ConstructorParameters<typeof PreCreationView>[0],
				plugin as unknown as ConstructorParameters<typeof PreCreationView>[1],
				{} as ConstructorParameters<typeof PreCreationView>[2],
			);
			leaf.view = view;
			await view.setState(
				{ linktext: "Old", sourcePath: "source.md", expectedPath: "Old.md" },
				{ history: false },
			);

			const title = document.querySelector<HTMLDivElement>(".inline-title");
			expect(title).not.toBeNull();
			if (!title?.firstChild) return;
			title.focus();
			title.textContent = "NewName";
			expect(title.firstChild).not.toBeNull();
			title.dispatchEvent(new Event("input", { bubbles: true }));
			const range = document.createRange();
			range.setStart(title.firstChild, offset);
			range.collapse(true);
			const selection = document.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);

			const event = new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			});
			title.dispatchEvent(event);

			expect(event.defaultPrevented).toBe(true);
			await waitFor(() =>
				expect(renameLinks).toHaveBeenCalledWith(
					leaf.app,
					plugin.indexingService,
					plugin.indexUpdateQueue,
					"Old",
					"NewName",
				),
			);
			await waitFor(() =>
				expect(showNotice).toHaveBeenCalledWith(
					failed
						? "Renamed 2 unresolved links; failed in 1 file. Check console for details."
						: "Renamed 2 unresolved links.",
				),
			);
			expect(view.getState().creationPath).toBe(failed ? "Old.md" : "NewName.md");
		},
	);
});
