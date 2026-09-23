import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import InteractiveSectionHeaderHarness from "./InteractiveSectionHeaderHarness.svelte";
import InteractiveSectionHeaderSwapHarness from "./InteractiveSectionHeaderSwapHarness.svelte";
import { createInteractionRegistry } from "cards/interactions/interactionRegistry";
import {
	getInteractionHandleFromElement,
	type SectionHeaderInteractionDescriptor,
} from "cards/interactions/interactionTypes";

vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof import("obsidian")>("obsidian");
	return {
		...actual,
		Platform: {
			isMobile: false,
		},
	};
});

function createDescriptor(
	interactionId: string,
	rawText: string,
): SectionHeaderInteractionDescriptor {
	return {
		interactionId,
		kind: "sectionHeader",
		link: {
			rawText,
			path: undefined,
			isUnresolved: true,
			sourceFile: null,
		} as never,
		isOutgoingLink: true,
		targetFile: null,
	};
}

describe("InteractiveSectionHeader", () => {
	afterEach(() => {
		cleanup();
	});

	it("registers and unregisters its interaction descriptor through the registry context", async () => {
		const registry = createInteractionRegistry();
		const initialDescriptor = createDescriptor(
			"section:header-initial",
			"header-target-initial",
		);
		const nextDescriptor = createDescriptor(
			"section:header-next",
			"header-target-next",
		);

		const view = render(InteractiveSectionHeaderHarness, {
			props: {
				registry,
				descriptor: initialDescriptor,
			},
		});

		const header = view.container.querySelector<HTMLElement>(".ccl-box");
		const interactionHandle = getInteractionHandleFromElement(header);
		expect(interactionHandle).not.toBeNull();
		expect(registry.resolve(interactionHandle!)).toStrictEqual(initialDescriptor);
		expect(header).toHaveAttribute("data-ccl-interaction-handle");
		expect(header).not.toHaveAttribute("data-ccl-interaction-kind");
		expect(header).not.toHaveAttribute("data-directory");

		await view.rerender({
			registry,
			descriptor: nextDescriptor,
		});

		const nextHandle = getInteractionHandleFromElement(header);
		expect(nextHandle).not.toBe(interactionHandle);
		expect(registry.resolve(interactionHandle!)).toBeUndefined();
		expect(registry.resolve(nextHandle!)).toStrictEqual(nextDescriptor);

		const refreshed = { ...nextDescriptor, searchQuery: "updated" };
		await view.rerender({ registry, descriptor: refreshed });
		expect(getInteractionHandleFromElement(header)).toBe(nextHandle);
		expect(registry.resolve(nextHandle!)).toStrictEqual(refreshed);

		view.unmount();

		expect(registry.resolve(interactionHandle!)).toBeUndefined();
		expect(registry.resolve(nextHandle!)).toBeUndefined();
	});

	it("releases the previous descriptor when the prop transitions to undefined on rebind", async () => {
		const registry = createInteractionRegistry();
		const initialDescriptor = createDescriptor(
			"section:header-rebind",
			"rebind-target",
		);

		const view = render(InteractiveSectionHeaderHarness, {
			props: {
				registry,
				descriptor: initialDescriptor,
			},
		});

		const header = view.container.querySelector<HTMLElement>(".ccl-box");
		const interactionHandle = getInteractionHandleFromElement(header);
		expect(interactionHandle).not.toBeNull();
		expect(registry.resolve(interactionHandle!)).toStrictEqual(initialDescriptor);

		await view.rerender({
			registry,
			descriptor: undefined,
		});

		expect(registry.resolve(interactionHandle!)).toBeUndefined();
		expect(getInteractionHandleFromElement(header)).toBeNull();
		await view.rerender({ registry, descriptor: initialDescriptor });
		const nextHandle = getInteractionHandleFromElement(header);
		expect(nextHandle).not.toBe(interactionHandle);
		expect(registry.resolve(interactionHandle!)).toBeUndefined();
		expect(registry.resolve(nextHandle!)).toStrictEqual(initialDescriptor);
	});

	it.each([
		{
			name: "two resident slots swap headers",
			initialIds: ["h0", "h1"],
			reorderedIds: ["h1", "h0"],
		},
		{
			name: "three resident slots rotate headers",
			initialIds: ["h0", "h1", "h2"],
			reorderedIds: ["h1", "h2", "h0"],
		},
	])(
		"preserves every descriptor when $name",
		async ({ initialIds, reorderedIds }) => {
			const registry = createInteractionRegistry();
			const descriptors = new Map(
				initialIds.map((interactionId) => [
					interactionId,
					createDescriptor(interactionId, `target-${interactionId}`),
				]),
			);
			const resolveDescriptors = (ids: readonly string[]) =>
				ids.map((interactionId) => descriptors.get(interactionId)!);
			const view = render(InteractiveSectionHeaderSwapHarness, {
				props: { registry, descriptors: resolveDescriptors(initialIds) },
			});

			await view.rerender({
				registry,
				descriptors: resolveDescriptors(reorderedIds),
			});

			const registeredDescriptors = Array.from(
				view.container.querySelectorAll<HTMLElement>(
					"[data-ccl-interaction-handle]",
				),
			).map((element) => {
				const handle = getInteractionHandleFromElement(element);
				return handle ? registry.resolve(handle) : undefined;
			});
			for (const descriptor of descriptors.values()) {
				expect(registeredDescriptors).toContain(descriptor);
			}
		},
	);
});
