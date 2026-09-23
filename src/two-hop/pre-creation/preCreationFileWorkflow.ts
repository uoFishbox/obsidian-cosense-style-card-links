interface PreCreationFileWorkflowOptions<TFile extends { readonly path: string }> {
	creationPath: string;
	finalPath: string;
	createFile(path: string): Promise<TFile>;
	renameFile(file: TFile, newPath: string): Promise<void>;
	deleteFile(file: TFile): Promise<void>;
	waitForIndexIdle(): Promise<void>;
}

export async function materializePreCreationFile<
	TFile extends { readonly path: string },
>(options: PreCreationFileWorkflowOptions<TFile>): Promise<TFile> {
	const file = await options.createFile(options.creationPath);
	if (options.creationPath === options.finalPath) {
		return file;
	}

	try {
		await options.waitForIndexIdle();
		await options.renameFile(file, options.finalPath);
	} catch (error) {
		// A failed rename can still have moved the file before throwing. Never
		// remove it unless it is still at the temporary path we created.
		if (file.path === options.creationPath) {
			try {
				await options.deleteFile(file);
			} catch (cleanupError) {
				console.error(
					"[Cosense card links] Failed to clean up the intermediate file:",
					cleanupError,
				);
			}
		}
		throw error;
	}
	try {
		await options.waitForIndexIdle();
	} catch (error) {
		// The rename succeeded: do not leave a materialized file behind in the
		// pre-creation view just because indexing failed to become idle.
		console.warn(
			"[Cosense card links] Index did not become idle after file creation:",
			error,
		);
	}
	return file;
}
