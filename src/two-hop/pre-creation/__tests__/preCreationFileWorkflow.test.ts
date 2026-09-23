import { vi } from "vitest";
import { materializePreCreationFile } from "../preCreationFileWorkflow";

test("creates the original path before renaming after each index transition", async () => {
	const calls: string[] = [];
	const file = { path: "Original.md" };

	const result = await materializePreCreationFile({
		creationPath: "Original.md",
		finalPath: "Renamed.md",
		createFile: async (path) => {
			calls.push(`create:${path}`);
			return file;
		},
		renameFile: async (createdFile, newPath) => {
			calls.push(`rename:${createdFile.path}->${newPath}`);
			createdFile.path = newPath;
		},
		deleteFile: async () => {
			calls.push("delete");
		},
		waitForIndexIdle: async () => {
			calls.push("index-idle");
		},
	});

	expect(result).toBe(file);
	expect(calls).toEqual([
		"create:Original.md",
		"index-idle",
		"rename:Original.md->Renamed.md",
		"index-idle",
	]);
});

test.each(["index wait", "rename"])(
	"removes the intermediate file when %s fails, so creation can be retried",
	async (failure) => {
		const paths = new Set<string>();
		const file = { path: "Original.md" };
		const createFile = async (path: string) => {
			if (paths.has(path)) throw new Error("already exists");
			paths.add(path);
			return file;
		};
		const deleteFile = vi.fn(async (created: typeof file) => {
			paths.delete(created.path);
		});
		const renameFile = async (created: typeof file, path: string) => {
			if (failure === "rename") throw new Error("rename failed");
			paths.delete(created.path);
			created.path = path;
			paths.add(path);
		};
		const waitForIndexIdle = async () => {
			if (failure === "index wait") throw new Error("index failed");
		};
		const options = {
			creationPath: "Original.md",
			finalPath: "Renamed.md",
			createFile,
			renameFile,
			deleteFile,
			waitForIndexIdle,
		};

		await expect(materializePreCreationFile(options)).rejects.toThrow();
		expect(paths.size).toBe(0);
		expect(deleteFile).toHaveBeenCalledWith(file);
		await expect(materializePreCreationFile(options)).rejects.toThrow();
		expect(paths.size).toBe(0);
	},
);

test("does not delete a file that moved before rename reported an error", async () => {
	const file = { path: "Original.md" };
	const deleteFile = vi.fn(async () => {});
	await expect(
		materializePreCreationFile({
			creationPath: "Original.md",
			finalPath: "Renamed.md",
			createFile: async () => file,
			renameFile: async (created, path) => {
				created.path = path;
				throw new Error("post-rename failure");
			},
			deleteFile,
			waitForIndexIdle: async () => {},
		}),
	).rejects.toThrow("post-rename failure");
	expect(deleteFile).not.toHaveBeenCalled();
});

test("returns the renamed file even when the final index wait fails", async () => {
	const file = { path: "Original.md" };
	const deleteFile = vi.fn(async () => {});
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	let waits = 0;

	const result = await materializePreCreationFile({
		creationPath: "Original.md",
		finalPath: "Renamed.md",
		createFile: async () => file,
		renameFile: async (created, path) => {
			created.path = path;
		},
		deleteFile,
		waitForIndexIdle: async () => {
			if (++waits === 2) throw new Error("index failed");
		},
	});
	expect(result).toBe(file);
	expect(file.path).toBe("Renamed.md");
	expect(deleteFile).not.toHaveBeenCalled();
	expect(warn).toHaveBeenCalledOnce();
	warn.mockRestore();
});

test("creates directly without index waits when the title is unchanged", async () => {
	const calls: string[] = [];
	const file = { path: "Original.md" };

	await materializePreCreationFile({
		creationPath: "Original.md",
		finalPath: "Original.md",
		createFile: async (path) => {
			calls.push(`create:${path}`);
			return file;
		},
		renameFile: async () => {
			calls.push("rename");
		},
		deleteFile: async () => {
			calls.push("delete");
		},
		waitForIndexIdle: async () => {
			calls.push("index-idle");
		},
	});

	expect(calls).toEqual(["create:Original.md"]);
});
