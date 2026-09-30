import { GameBounds, MapPosition } from '@/types/map.js';
import { appSettings } from '@/core/settings.js';

import { mapState } from '@/core/state.js';

import { FocusManager } from '@/systems/focusManager.js';
import { activeHoveredMarker } from '@/systems/markerController.js';
import { OverlayManager } from '@/managers/overlayManager.js';

import { MapUtils } from '@/utils/mapUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { QuestCard } from '@/components/QuestCard.js';
import { SettlementCard } from '@/components/SettlementCard.js';

import { FloatingCard } from '@/components/ui/FloatingCard.js';

const viewport = document.getElementById('map-viewport') as HTMLElement;
const container = document.getElementById('screen-container') as HTMLElement;

export const MapViewport = {

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
            const svg = activeHoveredMarker.querySelector('svg');
            const rect = svg ? svg.getBoundingClientRect() : activeHoveredMarker.getBoundingClientRect();
            const container = document.getElementById('global-nametag-container');
            if (container) {
                container.style.left = `${rect.left + rect.width / 2}px`;
                container.style.top = `${rect.bottom}px`;
            }
        }

        FloatingCard.repositionAll();
    },

    _syncSavedViewport() {
        if (mapState.savedViewport) {
            mapState.savedViewport = { zoom: mapState.zoom, panX: mapState.panX, panY: mapState.panY };
        }
    },

    _updateDragOrigin() {
        if (mapState.isDragging) {
            mapState.startX = this.lastMouseX - mapState.panX;
            mapState.startY = this.lastMouseY - mapState.panY;
        }
    },

    _applyZoom(newZoom: number, anchorX: number, anchorY: number, updateDOM: boolean) {
        const oldZoom = mapState.zoom;
        mapState.zoom = newZoom;

        const unzoomedX = (anchorX - mapState.panX) / oldZoom;
        const unzoomedY = (anchorY - mapState.panY) / oldZoom;

        mapState.panX = anchorX - (unzoomedX * mapState.zoom);
        mapState.panY = anchorY - (unzoomedY * mapState.zoom);

        this._updateDragOrigin();
        this._syncSavedViewport();

        if (updateDOM) {
            this.updateViewportTransform();
        }
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

    setPan(x: number, y: number) {
        mapState.panX = x;
        mapState.panY = y;

        this._syncSavedViewport();
        this.updateViewportTransform();
    },

    panBy(dx: number, dy: number) {
        this.setPan(mapState.panX + dx, mapState.panY + dy);
    },

    _centerOnUnzoomedCoords(unzoomedX: number, unzoomedY: number, targetZoom: number) {
        this.saveCurrentViewport();
        mapState.zoom = targetZoom;

        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        mapState.panX = screenCenterX - (unzoomedX * mapState.zoom);
        mapState.panY = screenCenterY - (unzoomedY * mapState.zoom);

        this.updateViewportTransform();
    },

    centerOnMapCoords(gameX: number, gameY: number, bounds: GameBounds, targetZoom: number = 2.5) {
        if (!viewport || !mapState.activeMapConfig) return;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const screenPos = MapUtils.gameToMapCoords(gameX, gameY, 0, bounds, mapState.activeMapConfig.gutters!);

        const unzoomedX = (screenPos.x / 100) * baseSize;
        const unzoomedY = (screenPos.y / 100) * baseSize;

        this._centerOnUnzoomedCoords(unzoomedX, unzoomedY, targetZoom);
    },

    centerOnTarget(worldspace: number, x: number, y: number, z: number = 0, targetZoom: number = 2.5): boolean {
        const config = mapState.activeMapConfig;
        if (!config || !mapState.lastPayload) return false;
        
        const resolved = WorldspaceUtils.resolveGatewayTarget(
            worldspace,
            config.worldspaceID,
            x,
            y,
            z,
            mapState.player.x,
            mapState.player.y,
            mapState.lastPayload
        );
        
        if (resolved) {
            this.centerOnWorldCoords(resolved.x, resolved.y, targetZoom);
            return true;
        }
        return false;
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

        const oldZoom = mapState.zoom;
        const oldPanX = mapState.panX;
        const oldPanY = mapState.panY;

        const svgEl = el.querySelector('svg');
        const mRect = svgEl ? svgEl.getBoundingClientRect() : el.getBoundingClientRect();
        const elementCenterX = mRect.left + (mRect.width / 2);
        const elementCenterY = mRect.top + (mRect.height / 2);

        const unzoomedX = (elementCenterX - oldPanX) / oldZoom;
        const unzoomedY = (elementCenterY - oldPanY) / oldZoom;

        this._centerOnUnzoomedCoords(unzoomedX, unzoomedY, targetZoom);
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
            const svgEl = markerEl.querySelector('svg');
            const mRect = svgEl ? svgEl.getBoundingClientRect() : markerEl.getBoundingClientRect();
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

        let lastPanTime = performance.now();
        let fracX = 0;
        let fracY = 0;

        const edgePanLoop = () => {
            const now = performance.now();
            const isControllerActive = document.body.classList.contains('controller-active');

            if (isControllerActive && FocusManager.getFocus() === 'MAP') {
                const edgeThresholdX = window.innerWidth * 0.02;
                const edgeThresholdY = window.innerHeight * 0.02;
                let panDx = 0;
                let panDy = 0;
                
                if (this.lastMouseX < edgeThresholdX) panDx = 1;
                else if (this.lastMouseX > window.innerWidth - edgeThresholdX) panDx = -1;
                
                if (this.lastMouseY < edgeThresholdY) panDy = 1;
                else if (this.lastMouseY > window.innerHeight - edgeThresholdY) panDy = -1;

                if (panDx !== 0 || panDy !== 0) {
                    let dt = (now - lastPanTime) / 1000;
                    if (dt > 0.1) dt = 0.016;
                    
                    const speed = 1000 * dt;
                    
                    const totalDx = (panDx * speed) + fracX;
                    const totalDy = (panDy * speed) + fracY;
                    
                    const dx = Math.trunc(totalDx);
                    const dy = Math.trunc(totalDy);
                    
                    fracX = totalDx - dx;
                    fracY = totalDy - dy;

                    if (dx !== 0 || dy !== 0) {
                        this.panBy(
                            dx * appSettings.gamepadPanSensitivity, 
                            dy * appSettings.gamepadPanSensitivity
                        );
                    }
                }
            }
            
            lastPanTime = performance.now();
            requestAnimationFrame(edgePanLoop);
        };
        
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(edgePanLoop);
        }

        container.addEventListener('wheel', (e: WheelEvent) => {
            if (FocusManager.getFocus() !== 'MAP') return;
            e.preventDefault();

            let deltaY = e.deltaY;
            if (e.deltaMode === 1) deltaY *= 33;
            else if (e.deltaMode === 2) deltaY *= window.innerHeight;

            const normalizedDelta = deltaY / 100;
            const factor = Math.pow(1.25, -normalizedDelta);
            const newZoom = Math.max(mapState.maxZoomOut, Math.min(mapState.maxZoomIn, mapState.zoom * factor));

            if (Math.abs(newZoom - mapState.zoom) > 0.001) {
                this._applyZoom(newZoom, e.clientX, e.clientY, true);
            }
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
                if (!mapState.wasDragged) {
                    mapState.wasDragged = true;
                    OverlayManager.dismissAll();
                }
            }
            this.setPan(e.clientX - mapState.startX, e.clientY - mapState.startY);
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
