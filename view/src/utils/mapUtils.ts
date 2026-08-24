import { GameBounds } from '@/types/map.js';
import { CELL_SIZE_UNITS } from '@/core/constants.js';
import { mapState } from '@/core/state.js';

export const MapUtils = {
    /**
     * Computes the effective world space coordinate bounding box for a given worldspace payload.
     */
    getEffectiveBounds(bounds: GameBounds) {
        const overrides = mapState.activeMapConfig?.cellBounds;
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
     * Normalizes game grid units into screen percentage numbers 
     * using active worldspace boundaries and precise gutter metrics.
     */
    gameToMapCoords(gameX: number, gameY: number, gameZ: number, bounds: GameBounds, gutters: { left: number; right: number; top: number; bottom: number }) {
        let effectiveX = gameX;
        let effectiveY = gameY;
        if (bounds.mapScale !== undefined && bounds.mapScale !== 0 && bounds.mapScale !== 1.0) {
            effectiveX = (gameX + (bounds.mapOffsetX ?? 0)) * bounds.mapScale;
            effectiveY = (gameY + (bounds.mapOffsetY ?? 0)) * bounds.mapScale;
        } else if (bounds.mapOffsetX || bounds.mapOffsetY) {
            effectiveX = gameX + (bounds.mapOffsetX ?? 0);
            effectiveY = gameY + (bounds.mapOffsetY ?? 0);
        }

        const { minX, maxX, minY, maxY } = this.getEffectiveBounds(bounds);
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;
        
        const rawPctX = (effectiveX - minX) / totalWidth;
        const rawPctY = (effectiveY - minY) / totalHeight;
        
        const usableWidthPct = 1.0 - gutters.left - gutters.right;
        const usableHeightPct = 1.0 - gutters.top - gutters.bottom;
        
        const pctX = (gutters.left + (rawPctX * usableWidthPct)) * 100;
        const pctY = (gutters.top + ((1.0 - rawPctY) * usableHeightPct)) * 100;
        
        return { x: pctX, y: pctY, z: gameZ };
    },

    /**
     * Converts screen pixel coordinates (e.g. mouse event clientX, clientY) back to world space coordinates (gameX, gameY).
     */
    screenToGameCoords(screenX: number, screenY: number, bounds: GameBounds, gutters: { left: number; right: number; top: number; bottom: number }, zoom: number, panX: number, panY: number) {
        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const mapCurrentSize = baseSize * zoom;

        const pctX = (screenX - panX) / mapCurrentSize;
        const pctY = (screenY - panY) / mapCurrentSize;

        const usableWidthPct = 1.0 - gutters.left - gutters.right;
        const usableHeightPct = 1.0 - gutters.top - gutters.bottom;

        const rawPctX = (pctX - gutters.left) / usableWidthPct;
        const rawPctY = 1.0 - ((pctY - gutters.top) / usableHeightPct);

        const { minX, maxX, minY, maxY } = this.getEffectiveBounds(bounds);
        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;

        let gameX = minX + (rawPctX * totalWidth);
        let gameY = minY + (rawPctY * totalHeight);

        if (bounds.mapScale !== undefined && bounds.mapScale !== 0 && bounds.mapScale !== 1.0) {
            gameX = (gameX / bounds.mapScale) - (bounds.mapOffsetX ?? 0);
            gameY = (gameY / bounds.mapScale) - (bounds.mapOffsetY ?? 0);
        } else if (bounds.mapOffsetX || bounds.mapOffsetY) {
            gameX = gameX - (bounds.mapOffsetX ?? 0);
            gameY = gameY - (bounds.mapOffsetY ?? 0);
        }

        return { x: gameX, y: gameY };
    }
};
