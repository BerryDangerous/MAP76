import { GameBounds, CellBoundsOverride } from '@/types/map.js';
import { CELL_SIZE_UNITS } from '@/core/constants.js';
import { domainState } from '@/core/state/index.js';

export const MapUtils = {
    /**
     * Computes the effective world space coordinate bounding box for a given worldspace payload.
     * Prevents cross-worldspace override contamination by checking if the bounds match the active worldspace.
     */
    getEffectiveBounds(bounds: GameBounds, cellBounds?: CellBoundsOverride) {
        const activeWsId = domainState.activeMapConfig?.worldspaceID;
        const activeBounds = activeWsId !== undefined ? domainState.lastPayload?.worldspaces?.[activeWsId]?.bounds : undefined;
        const overrides = cellBounds !== undefined
            ? cellBounds
            : (activeBounds && bounds === activeBounds ? domainState.activeMapConfig?.cellBounds : undefined);

        const nwCellX = overrides ? overrides.nwCellX : bounds.nwCellX;
        const seCellX = overrides ? overrides.seCellX : bounds.seCellX;
        const nwCellY = overrides ? overrides.nwCellY : bounds.nwCellY;
        const seCellY = overrides ? overrides.seCellY : bounds.seCellY;

        const minX = (nwCellX !== undefined) ? nwCellX * CELL_SIZE_UNITS : bounds.minX;
        const maxX = (seCellX !== undefined) ? seCellX * CELL_SIZE_UNITS : bounds.maxX;
        const maxY = (nwCellY !== undefined) ? nwCellY * CELL_SIZE_UNITS : bounds.maxY;
        const minY = (seCellY !== undefined) ? seCellY * CELL_SIZE_UNITS : bounds.minY;

        return { minX, maxX, minY, maxY };
    },

    /**
     * Maps an absolute game coordinate (X, Y) to percentage-based screen space (0-100%).
     */
    gameToMapCoords(gameX: number, gameY: number, gameZ: number, bounds: GameBounds, gutters: { left: number, right: number, top: number, bottom: number }) {
        const effectiveBounds = this.getEffectiveBounds(bounds);
        const { minX, maxX, minY, maxY } = effectiveBounds;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        const normX = rangeX === 0 ? 0.5 : (gameX - minX) / rangeX;
        const normY = rangeY === 0 ? 0.5 : 1 - ((gameY - minY) / rangeY);

        const mapWidthFactor = 1 - gutters.left - gutters.right;
        const mapHeightFactor = 1 - gutters.top - gutters.bottom;

        const mapX = gutters.left + (normX * mapWidthFactor);
        const mapY = gutters.top + (normY * mapHeightFactor);

        return {
            x: mapX * 100,
            y: mapY * 100
        };
    },

    /**
     * Converts raw viewport screen pixel coordinates back into Fallout 4 game coordinates.
     */
    screenToGameCoords(
        screenX: number, 
        screenY: number, 
        bounds: GameBounds, 
        gutters: { left: number, right: number, top: number, bottom: number },
        zoom: number,
        panX: number,
        panY: number
    ): { x: number, y: number } {
        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const unzoomedX = (screenX - panX) / zoom;
        const unzoomedY = (screenY - panY) / zoom;

        const pctX = unzoomedX / baseSize;
        const pctY = unzoomedY / baseSize;

        const mapWidthFactor = 1 - gutters.left - gutters.right;
        const mapHeightFactor = 1 - gutters.top - gutters.bottom;

        const normX = (pctX - gutters.left) / mapWidthFactor;
        const normY = (pctY - gutters.top) / mapHeightFactor;

        const effectiveBounds = this.getEffectiveBounds(bounds);
        const { minX, maxX, minY, maxY } = effectiveBounds;

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;

        const gameX = minX + (normX * rangeX);
        const gameY = maxY - (normY * rangeY);

        return { x: gameX, y: gameY };
    }
};
