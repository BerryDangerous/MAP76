import { GameBounds, CellBoundsOverride } from '@/types/map.js';
import { CELL_SIZE_UNITS } from '@/core/constants.js';
import { domainState } from './index.js';

export interface EffectiveBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export function isSameWorldspace(ws1: number, ws2: number): boolean {
    return ws1 === ws2;
}

/**
 * Retrieves the display name of a worldspace by form ID from the synchronized domain store.
 */
export function getWorldspaceName(worldspaceId?: number): string | undefined {
    if (worldspaceId === undefined) return undefined;
    const ws = domainState.worldspaces.get(worldspaceId);
    if (ws) return ws.fullName;
    return domainState.lastPayload?.worldspaces?.[worldspaceId]?.fullName;
}

/**
 * Retrieves the engine editor ID of a worldspace by form ID from the synchronized domain store.
 */
export function getWorldspaceEditorID(worldspaceId?: number): string | undefined {
    if (worldspaceId === undefined) return undefined;
    const ws = domainState.worldspaces.get(worldspaceId);
    if (ws) return ws.editorID;
    return domainState.lastPayload?.worldspaces?.[worldspaceId]?.editorID;
}

/**
 * Computes the effective worldspace coordinate bounding box taking optional cell bounds overrides into account.
 * Pure mathematical calculation with zero global state dependencies.
 */
export function getEffectiveWorldspaceBounds(bounds: GameBounds, cellBounds?: CellBoundsOverride): EffectiveBounds {
    const nwCellX = cellBounds ? cellBounds.nwCellX : bounds.nwCellX;
    const seCellX = cellBounds ? cellBounds.seCellX : bounds.seCellX;
    const nwCellY = cellBounds ? cellBounds.nwCellY : bounds.nwCellY;
    const seCellY = cellBounds ? cellBounds.seCellY : bounds.seCellY;

    const minX = (nwCellX !== undefined) ? nwCellX * CELL_SIZE_UNITS : bounds.minX;
    const maxX = (seCellX !== undefined) ? seCellX * CELL_SIZE_UNITS : bounds.maxX;
    const maxY = (nwCellY !== undefined) ? nwCellY * CELL_SIZE_UNITS : bounds.maxY;
    const minY = (seCellY !== undefined) ? seCellY * CELL_SIZE_UNITS : bounds.minY;

    return { minX, maxX, minY, maxY };
}
