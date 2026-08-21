import { GameBounds, MapPosition } from '@/types/map.js';

import { CELL_SIZE_UNITS } from '@/core/constants.js';
import { mapState } from '@/core/state.js';

import { FocusManager } from '@/systems/focusManager.js';
import { activeHoveredMarker } from '@/systems/markerController.js';

import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { QuestCard } from '@/components/QuestCard.js';
import { SettlementCard } from '@/components/SettlementCard.js';

import { FloatingCard } from '@/components/ui/FloatingCard.js';

const viewport = document.getElementById('map-viewport') as HTMLElement;
const container = document.getElementById('screen-container') as HTMLElement;

export const MapViewport = {
    /**
     * Computes the effective world space coordinate bounding box for a given worldspace payload.
     */
    getEffectiveBounds(bounds: GameBounds) {
        const nwCellX = bounds.nwCellX;
        const seCellX = bounds.seCellX;
        const nwCellY = bounds.nwCellY;
        const seCellY = bounds.seCellY;

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
    gameToMapCoords(gameX: number, gameY: number, gameZ: number, bounds: GameBounds) {
        const config = mapState.activeMapConfig;
        if (!config) return { x: 0, y: 0, z: 0 };

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
        
        const usableWidthPct = 1.0 - config.gutters.left - config.gutters.right;
        const usableHeightPct = 1.0 - config.gutters.top - config.gutters.bottom;
        
        const pctX = (config.gutters.left + (rawPctX * usableWidthPct)) * 100;
        const pctY = (config.gutters.top + ((1.0 - rawPctY) * usableHeightPct)) * 100;
        
        return { x: pctX, y: pctY, z: gameZ };
    },

    /**
     * Converts screen pixel coordinates (e.g. mouse event clientX, clientY) back to world space coordinates (gameX, gameY).
     */
    screenToGameCoords(screenX: number, screenY: number, bounds: GameBounds) {
        const config = mapState.activeMapConfig;
        if (!config) return { x: 0, y: 0 };

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const mapCurrentSize = baseSize * mapState.zoom;

        const pctX = (screenX - mapState.panX) / mapCurrentSize;
        const pctY = (screenY - mapState.panY) / mapCurrentSize;

        const usableWidthPct = 1.0 - config.gutters.left - config.gutters.right;
        const usableHeightPct = 1.0 - config.gutters.top - config.gutters.bottom;

        const rawPctX = (pctX - config.gutters.left) / usableWidthPct;
        const rawPctY = 1.0 - ((pctY - config.gutters.top) / usableHeightPct);

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
    },

    /**
     * Calculates pan boundaries to ensure the map canvas completely spans the window bounds.
     */
    updateViewportTransform() {
        if (!viewport) return;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const viewportWidth = baseSize * mapState.zoom;
        const viewportHeight = baseSize * mapState.zoom;
        
        const minPanX = window.innerWidth - viewportWidth;
        const minPanY = window.innerHeight - viewportHeight;
        
        if (viewportWidth > window.innerWidth) {
            mapState.panX = Math.min(0, Math.max(minPanX, mapState.panX));
        } else {
            mapState.panX = (window.innerWidth - viewportWidth) / 2;
        }
        
        if (viewportHeight > window.innerHeight) {
            mapState.panY = Math.min(0, Math.max(minPanY, mapState.panY));
        } else {
            mapState.panY = (window.innerHeight - viewportHeight) / 2;
        }
        
        viewport.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.zoom})`;
        
        const markerScale = Math.sqrt(mapState.zoom) / mapState.zoom;
        viewport.style.setProperty('--marker-scale', markerScale.toString());
        
        const playerImg = document.getElementById('player-marker') as HTMLElement;
        if (playerImg && mapState.player.active) {
            playerImg.style.setProperty('--marker-scale', markerScale.toString());
            playerImg.style.setProperty('--player-angle', `${mapState.player.angle}deg`);
        }

        if (activeHoveredMarker) {
            const img = activeHoveredMarker.querySelector('img');
            const rect = img ? img.getBoundingClientRect() : activeHoveredMarker.getBoundingClientRect();
            const container = document.getElementById('global-nametag-container');
            if (container) {
                container.style.left = `${rect.left + rect.width / 2}px`;
                container.style.top = `${rect.bottom}px`;
            }
        }

        FloatingCard.repositionAll();
    },

    centerInitialViewport() {
        mapState.zoom = 1.0;
        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        mapState.panX = (window.innerWidth - baseSize) / 2;
        mapState.panY = (window.innerHeight - baseSize) / 2;
        this.updateViewportTransform();
    },

    saveCurrentViewport() {
        if (!mapState.savedViewport) {
            mapState.savedViewport = {
                zoom: mapState.zoom,
                panX: mapState.panX,
                panY: mapState.panY
            };
        }
    },

    clearSavedViewport(restore: boolean = true) {
        if (mapState.savedViewport) {
            if (restore) {
                mapState.zoom = mapState.savedViewport.zoom;
                mapState.panX = mapState.savedViewport.panX;
                mapState.panY = mapState.savedViewport.panY;
                this.updateViewportTransform();
            }
            mapState.savedViewport = null;
        }
    },

    centerOnMapCoords(gameX: number, gameY: number, bounds: GameBounds, targetZoom: number = 2.5) {
        if (!viewport) return;

        this.saveCurrentViewport();

        mapState.zoom = targetZoom;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const currentViewportSize = baseSize * mapState.zoom;

        const screenPos = this.gameToMapCoords(gameX, gameY, 0, bounds);

        const pixelOnBaseX = (screenPos.x / 100) * baseSize;
        const pixelOnBaseY = (screenPos.y / 100) * baseSize;

        const pixelOnZoomedX = pixelOnBaseX * mapState.zoom;
        const pixelOnZoomedY = pixelOnBaseY * mapState.zoom;

        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        mapState.panX = screenCenterX - pixelOnZoomedX;
        mapState.panY = screenCenterY - pixelOnZoomedY;

        this.updateViewportTransform();
    },

    centerOnWorldCoords(gameX: number, gameY: number, targetZoom: number = 2.5): void {
        const config = mapState.activeMapConfig;
        const worldspaceData = mapState.lastPayload?.worldspaces?.[config.worldspaceID];
        const bounds = worldspaceData?.bounds;
        if (bounds) {
            this.centerOnMapCoords(gameX, gameY, bounds, targetZoom);
        }
    },

    centerOnElement(el: HTMLElement, targetZoom: number = 2.5): void {
        if (!viewport) return;

        this.saveCurrentViewport();
        const oldZoom = mapState.zoom;
        const oldPanX = mapState.panX;
        const oldPanY = mapState.panY;
        
        mapState.zoom = targetZoom;

        const imgEl = el.querySelector('img');
        const mRect = imgEl ? imgEl.getBoundingClientRect() : el.getBoundingClientRect();
        const elementCenterX = mRect.left + (mRect.width / 2);
        const elementCenterY = mRect.top + (mRect.height / 2);

        const mapTargetX = (elementCenterX - oldPanX) / oldZoom;
        const mapTargetY = (elementCenterY - oldPanY) / oldZoom;

        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        mapState.panX = screenCenterX - (mapTargetX * mapState.zoom);
        mapState.panY = screenCenterY - (mapTargetY * mapState.zoom);

        this.updateViewportTransform();
    },

    lastMouseX: window.innerWidth / 2,
    lastMouseY: window.innerHeight / 2,

    performZoom(direction: 'in' | 'out', clientX: number, clientY: number) {
        const zoomIntensity = 0.15;
        let zoomPointX = clientX;
        let zoomPointY = clientY;
        
        let markerEl: HTMLElement | null = null;
        if (QuestCard.isOpen()) {
            markerEl = QuestCard.activeAnchorMarker;
            if (!markerEl) {
                const questFormId = QuestCard.activeQuest?.formId;
                const questName = QuestCard.activeQuest?.questName;
                const questMarkers = document.querySelectorAll('.quest-marker');
                for (const el of questMarkers) {
                    const htmlEl = el as HTMLElement;
                    if ((questFormId && htmlEl.dataset.formId === questFormId.toString()) || htmlEl.dataset.displayName === questName) {
                        markerEl = htmlEl;
                        break;
                    }
                }
            }
        } else if (MarkerCard.isOpen()) {
            markerEl = MarkerCard.activeAnchorMarker;
        } else if (SettlementCard.isOpen()) {
            markerEl = SettlementCard.activeAnchorMarker;
        } else if (CustomMarkerCard.isOpen()) {
            markerEl = CustomMarkerCard.activeAnchorMarker;
        }

        if (markerEl) {
            const imgEl = markerEl.querySelector('img');
            const mRect = imgEl ? imgEl.getBoundingClientRect() : markerEl.getBoundingClientRect();
            zoomPointX = mRect.left + (mRect.width / 2);
            zoomPointY = mRect.top + (mRect.height / 2);
        }

        const mapTargetX = (zoomPointX - mapState.panX) / mapState.zoom;
        const mapTargetY = (zoomPointY - mapState.panY) / mapState.zoom;
        
        if (direction === 'in') {
            mapState.zoom = Math.min(mapState.maxZoomIn, mapState.zoom + zoomIntensity);
        } else {
            mapState.zoom = Math.max(mapState.maxZoomOut, mapState.zoom - zoomIntensity);
        }
        
        mapState.panX = zoomPointX - (mapTargetX * mapState.zoom);
        mapState.panY = zoomPointY - (mapTargetY * mapState.zoom);

        if (mapState.savedViewport) {
            mapState.savedViewport = {
                zoom: mapState.zoom,
                panX: mapState.panX,
                panY: mapState.panY
            };
        }

        this.updateViewportTransform();
    },

    initEvents() {
        if (!container || !viewport) return;

        window.addEventListener('resize', () => this.centerInitialViewport());
        
        window.addEventListener('mousemove', (e: MouseEvent) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        container.addEventListener('wheel', (e: WheelEvent) => {
            if (FocusManager.getFocus() !== 'MAP') return;
            e.preventDefault();
            this.performZoom(e.deltaY < 0 ? 'in' : 'out', e.clientX, e.clientY);
        }, { passive: false });

        let dragStartX = 0;
        let dragStartY = 0;

        viewport.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            mapState.isDragging = true;
            mapState.wasDragged = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            mapState.startX = e.clientX - mapState.panX;
            mapState.startY = e.clientY - mapState.panY;
            viewport.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!mapState.isDragging) return;
            if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
                mapState.wasDragged = true;
                if (FocusManager.getFocus() !== 'MAP') {
                    FocusManager.setFocus('MAP');
                }
            }
            mapState.panX = e.clientX - mapState.startX;
            mapState.panY = e.clientY - mapState.startY;

            if (mapState.savedViewport) {
                mapState.savedViewport = {
                    zoom: mapState.zoom,
                    panX: mapState.panX,
                    panY: mapState.panY
                };
            }

            this.updateViewportTransform();
        });

        window.addEventListener('mouseup', () => {
            if (!mapState.isDragging) return;
            mapState.isDragging = false;
            viewport.style.cursor = 'grab';
        });

        container.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
        });

        window.addEventListener('dragstart', (e) => e.preventDefault());
    }
};
