import {
	createInteractionHandle,
	type InteractionHandle,
	type ItemInteractionDescriptor,
} from "./interactionTypes";
import type { InteractionDescriptorResolverProvider } from "./interactionRegistry";

export interface VirtualCardInteractionController extends InteractionDescriptorResolverProvider {
	getInteractionHandle(physicalCellSlot: number): InteractionHandle;
	/**
	 * Synchronizes bindings by mounted key, independently of descriptor availability.
	 * A null descriptor keeps an unavailable binding; undefined excludes a non-card cell.
	 * Returns whether DOM handles need to be republished.
	 */
	syncMountedRows<
		TCell extends { readonly physicalCellSlot: number; readonly key: string },
	>(
		rows: readonly {
			readonly bindings: readonly (TCell | null | undefined)[];
		}[],
		resolveDescriptor: (
			cell: TCell,
		) => ItemInteractionDescriptor | null | undefined,
	): boolean;
	clear(): void;
}

interface MountedInteractionBinding {
	readonly handle: InteractionHandle;
	key: string | null;
}

/** Owns live card bindings; reusing a physical slot for another key invalidates its handle. */
export function createVirtualCardInteractionController(): VirtualCardInteractionController {
	const bindingBySlot = new Map<number, MountedInteractionBinding>();
	const descriptorByHandle = new Map<InteractionHandle, ItemInteractionDescriptor>();

	return {
		resolveInteractionDescriptor(interactionHandle) {
			return descriptorByHandle.get(interactionHandle) ?? null;
		},
		getInteractionHandle(physicalCellSlot) {
			const existing = bindingBySlot.get(physicalCellSlot);
			if (existing) return existing.handle;
			const handle = createInteractionHandle("v");
			bindingBySlot.set(physicalCellSlot, { handle, key: null });
			return handle;
		},
		syncMountedRows(rows, resolveDescriptor) {
			const activeSlots = new Set<number>();
			let handlesChanged = false;
			for (const row of rows) {
				for (const cell of row.bindings) {
					if (!cell) continue;
					const descriptor = resolveDescriptor(cell);
					if (descriptor === undefined) continue;
					const physicalCellSlot = cell.physicalCellSlot;
					activeSlots.add(physicalCellSlot);
					let binding = bindingBySlot.get(physicalCellSlot);
					if (
						!binding ||
						(binding.key !== null && binding.key !== cell.key)
					) {
						if (binding) descriptorByHandle.delete(binding.handle);
						binding = {
							handle: createInteractionHandle("v"),
							key: cell.key,
						};
						bindingBySlot.set(physicalCellSlot, binding);
						handlesChanged = true;
					}
					// The mounted identity survives lazy descriptor eviction/hydration.
					binding.key = cell.key;
					const { handle } = binding;
					if (descriptor) descriptorByHandle.set(handle, descriptor);
					else descriptorByHandle.delete(handle);
				}
			}
			for (const [physicalCellSlot, binding] of bindingBySlot) {
				if (!activeSlots.has(physicalCellSlot)) {
					descriptorByHandle.delete(binding.handle);
					bindingBySlot.delete(physicalCellSlot);
					handlesChanged = true;
				}
			}
			return handlesChanged;
		},
		clear() {
			bindingBySlot.clear();
			descriptorByHandle.clear();
		},
	};
}
