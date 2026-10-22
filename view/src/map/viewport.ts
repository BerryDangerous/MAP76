import { GameBounds } from '@/types/map.js';
import { appSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';

import { FocusManager } from '@/systems/focusManager.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';

import { viewportState } from '@/map/viewportState.js';
import { activeHoveredMarker } from '@/map/interactions.js';
import { gameToMapCoords } from '@/map/coordinates.js';
import { resolveGatewayTarget } from '@/map/gateways.js';
import type { MapSurface } from '@/map/mapSurface.js';

export const MapViewport = {
    _surface: null as MapSurface | null,
    _viewportEl: null as HTMLElement | null,
    _containerEl: null as HTMLElement | null,

    bindSurface(surface: MapSurface, viewportEl?: HTMLElement | null, containerEl?: HTMLElement | null) {
        this._surface = surface;
        this._viewportEl = viewportEl ?? null;
        this._containerEl = containerEl ?? null;
    },

    getViewportElement(): HTMLElement | null {
        if (!this._viewportEl) {
            this._viewportEl = document.getElementById('map-viewport');
        }
        return this._viewportEl;
    },

    getContainerElement(): HTMLElement | null {
        if (!this._containerEl) {
            this._containerEl = document.getElementById('screen-container');
        }
        return this._containerEl;
    },

    _inputFramePending: false,
    _pendingDrag: null as { clientX: number; clientY: number } | null,
    _pendingWheelDelta: 0,
    _pendingWheelX: 0,
    _pendingWheelY: 0,

    /**
     * Calculates pan boundaries to ensure the map canvas completely spans the window bounds.
     */
    updateViewportTransform() {
        const viewport = this.getViewportElement();
        if (!viewport) return;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const viewportWidth = baseSize * viewportState.zoom;
        const viewportHeight = baseSize * viewportState.zoom;
        
        const minPanX = window.innerWidth - viewportWidth;
        const minPanY = window.innerHeight - viewportHeight;
        
        if (viewportWidth > window.innerWidth) {
            viewportState.panX = Math.min(0, Math.max(minPanX, viewportState.panX));
        } else {
            viewportState.panX = (window.innerWidth - viewportWidth) / 2;
        }
        
        if (viewportHeight > window.innerHeight) {
            viewportState.panY = Math.min(0, Math.max(minPanY, viewportState.panY));
        } else {
            viewportState.panY = (window.innerHeight - viewportHeight) / 2;
        }
        
        viewport.style.transform = `translate(${viewportState.panX}px, ${viewportState.panY}px) scale(${viewportState.zoom})`;
        
        const markerScale = Math.sqrt(viewportState.zoom) / viewportState.zoom;
        viewport.style.setProperty('--marker-scale', markerScale.toString());
        
        const playerImg = document.getElementById('player-marker') as HTMLElement;
        if (playerImg && domainState.player.active) {
            playerImg.style.setProperty('--marker-scale', markerScale.toString());
            playerImg.style.setProperty('--player-angle', `${domainState.player.angle}deg`);
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

        this._surface?.events.emit('viewportChange', {
            zoom: viewportState.zoom,
            panX: viewportState.panX,
            panY: viewportState.panY
        });
    },

    _syncSavedViewport() {
        if (viewportState.savedViewport) {
            viewportState.savedViewport = { zoom: viewportState.zoom, panX: viewportState.panX, panY: viewportState.panY };
        }
    },

    _updateDragOrigin() {
        if (viewportState.isDragging) {
            viewportState.startX = this.lastMouseX - viewportState.panX;
            viewportState.startY = this.lastMouseY - viewportState.panY;
        }
    },

    _applyZoom(newZoom: number, anchorX: number, anchorY: number, updateDOM: boolean) {
        const oldZoom = viewportState.zoom;
        viewportState.zoom = newZoom;

        const unzoomedX = (anchorX - viewportState.panX) / oldZoom;
        const unzoomedY = (anchorY - viewportState.panY) / oldZoom;

        viewportState.panX = anchorX - (unzoomedX * viewportState.zoom);
        viewportState.panY = anchorY - (unzoomedY * viewportState.zoom);

        this._updateDragOrigin();
        this._syncSavedViewport();

        if (updateDOM) {
            this.updateViewportTransform();
        }
    },

    _processPendingWheel() {
        if (this._pendingWheelDelta === 0) return;

        const deltaY = this._pendingWheelDelta;
        const cx = this._pendingWheelX;
        const cy = this._pendingWheelY;
        this._pendingWheelDelta = 0;

        const normalizedDelta = deltaY / 100;
        const factor = Math.pow(1.25, -normalizedDelta);
        const newZoom = Math.max(viewportState.maxZoomOut, Math.min(viewportState.maxZoomIn, viewportState.zoom * factor));

        if (Math.abs(newZoom - viewportState.zoom) > 0.001) {
            SoundService.playMapZoom();
            this._applyZoom(newZoom, cx, cy, false);
        }
    },

    _processPendingDrag() {
        if (!this._pendingDrag || !viewportState.isDragging) return;

        const { clientX, clientY } = this._pendingDrag;
        this._pendingDrag = null;
        viewportState.panX = clientX - viewportState.startX;
        viewportState.panY = clientY - viewportState.startY;

        this._syncSavedViewport();
    },

    _scheduleInputFrame() {
        if (this._inputFramePending) return;
        this._inputFramePending = true;
        requestAnimationFrame(() => {
            this._inputFramePending = false;
            this._processPendingDrag();
            this._processPendingWheel();
            this.updateViewportTransform();
        });
    },

    centerInitialViewport() {
        this._activeZoomDir = null;
        viewportState.zoom = 1.0;
        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        viewportState.panX = (window.innerWidth - baseSize) / 2;
        viewportState.panY = (window.innerHeight - baseSize) / 2;
        this.updateViewportTransform();
    },

    saveCurrentViewport() {
        if (!viewportState.savedViewport) {
            viewportState.savedViewport = {
                zoom: viewportState.zoom,
                panX: viewportState.panX,
                panY: viewportState.panY
            };
        }
    },

    clearSavedViewport(restore: boolean = true) {
        if (viewportState.savedViewport) {
            if (restore) {
                viewportState.zoom = viewportState.savedViewport.zoom;
                viewportState.panX = viewportState.savedViewport.panX;
                viewportState.panY = viewportState.savedViewport.panY;
                this.updateViewportTransform();
            }
            viewportState.savedViewport = null;
        }
    },

    setPan(x: number, y: number) {
        viewportState.panX = x;
        viewportState.panY = y;

        this._syncSavedViewport();
        this.updateViewportTransform();
    },

    panBy(dx: number, dy: number) {
        this.setPan(viewportState.panX + dx, viewportState.panY + dy);
    },

    _centerOnUnzoomedCoords(unzoomedX: number, unzoomedY: number, targetZoom: number) {
        this.saveCurrentViewport();
        this._activeZoomDir = null;
        viewportState.zoom = targetZoom;

        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        viewportState.panX = screenCenterX - (unzoomedX * viewportState.zoom);
        viewportState.panY = screenCenterY - (unzoomedY * viewportState.zoom);

        this.updateViewportTransform();
    },

    centerOnMapCoords(gameX: number, gameY: number, bounds: GameBounds, targetZoom: number = 2.5) {
        const viewport = this.getViewportElement();
        const config = this._surface?.getActiveConfig();
        if (!viewport || !config) return;

        const baseSize = Math.max(window.innerWidth, window.innerHeight);
        const gutters = config.gutters ?? { left: 0, right: 0, top: 0, bottom: 0 };
        const screenPos = gameToMapCoords(gameX, gameY, 0, bounds, gutters, config.cellBounds);

        const unzoomedX = (screenPos.x / 100) * baseSize;
        const unzoomedY = (screenPos.y / 100) * baseSize;

        this._centerOnUnzoomedCoords(unzoomedX, unzoomedY, targetZoom);
    },

    centerOnTarget(worldspace: number, x: number, y: number, z: number = 0, targetZoom: number = 2.5): boolean {
        const config = this._surface?.getActiveConfig();
        if (!config) return false;
        
        const resolved = resolveGatewayTarget(
            worldspace,
            config.worldspaceID,
            { x, y, z },
            { x: domainState.player.x, y: domainState.player.y },
            domainState.lastPayload?.gateways,
            domainState.markers
        );
        
        if (resolved) {
            this.centerOnWorldCoords(resolved.x, resolved.y, targetZoom);
            return true;
        }
        return false;
    },

    centerOnWorldCoords(gameX: number, gameY: number, targetZoom: number = 2.5): void {
        const config = this._surface?.getActiveConfig();
        if (!config) return;
        const bounds = domainState.worldspaces.get(config.worldspaceID)?.bounds;
        if (bounds) {
            this.centerOnMapCoords(gameX, gameY, bounds, targetZoom);
        }
    },

    centerOnElement(el: HTMLElement, targetZoom: number = 2.5): void {
        const viewport = this.getViewportElement();
        if (!viewport) return;

        const oldZoom = viewportState.zoom;
        const oldPanX = viewportState.panX;
        const oldPanY = viewportState.panY;

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

    _getActiveAnchorMarker(): HTMLElement | null {
        return document.querySelector('.menu-active') as HTMLElement | null;
    },

    _zoomLoopRunning: false,
    _zoomAnchorX: 0,
    _zoomAnchorY: 0,
    _activeZoomDir: null as 'in' | 'out' | null,
    _zoomLastTime: 0,

    setZoomHold(direction: 'in' | 'out' | null, clientX: number, clientY: number) {
        if (this._activeZoomDir === direction) return;
        this._activeZoomDir = direction;

        if (direction) {
            this._zoomAnchorX = clientX;
            this._zoomAnchorY = clientY;

            const factor = direction === 'in' ? 1.15 : 0.85;
            const newZoom = Math.max(viewportState.maxZoomOut, Math.min(viewportState.maxZoomIn, viewportState.zoom * factor));
            if (newZoom !== viewportState.zoom) {
                SoundService.playMapZoom();
                this._applyZoomStep(newZoom, clientX, clientY);
            }

            if (!this._zoomLoopRunning) this._startZoomAnimation();
        }
    },

    _startZoomAnimation() {
        this._zoomLoopRunning = true;
        this._zoomLastTime = performance.now();
        requestAnimationFrame(this._zoomLoop.bind(this));
    },

    _zoomLoop(now: number) {
        if (!this._activeZoomDir) {
            this._zoomLoopRunning = false;
            return;
        }

        let dt = (now - this._zoomLastTime) / 1000;
        if (dt > 0.1) dt = 0.016;
        this._zoomLastTime = now;

        const continuousFactor = 4.0;
        const factor = this._activeZoomDir === 'in' ? Math.pow(continuousFactor, dt) : Math.pow(1 / continuousFactor, dt);
        const newZoom = Math.max(viewportState.maxZoomOut, Math.min(viewportState.maxZoomIn, viewportState.zoom * factor));

        if (newZoom !== viewportState.zoom) {
            SoundService.playMapZoom();
            this._applyZoomStep(newZoom, this._zoomAnchorX, this._zoomAnchorY);
            requestAnimationFrame(this._zoomLoop.bind(this));
        } else {
            requestAnimationFrame(this._zoomLoop.bind(this));
        }
    },

    _applyZoomStep(newZoom: number, anchorX: number, anchorY: number) {
        let zoomPointX = anchorX;
        let zoomPointY = anchorY;

        const markerEl = this._getActiveAnchorMarker();

        if (markerEl) {
            const svgEl = markerEl.querySelector('svg');
            const mRect = svgEl ? svgEl.getBoundingClientRect() : markerEl.getBoundingClientRect();
            zoomPointX = mRect.left + (mRect.width / 2);
            zoomPointY = mRect.top + (mRect.height / 2);
        }

        this._applyZoom(newZoom, zoomPointX, zoomPointY, true);
    },

    initEvents() {
        const container = this.getContainerElement();
        const viewport = this.getViewportElement();
        if (!container || !viewport) return;

        window.addEventListener('resize', () => this.centerInitialViewport());
        
        let dragStartX = 0;
        let dragStartY = 0;

        window.addEventListener('mousemove', (e: MouseEvent) => {
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            if (viewportState.isDragging) {
                if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) {
                    if (!viewportState.wasDragged) {
                        viewportState.wasDragged = true;
                        OverlayManager.dismissAll();
                    }
                }
                this._pendingDrag = { clientX: e.clientX, clientY: e.clientY };
                this._scheduleInputFrame();
            }
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

            this._pendingWheelDelta += deltaY;
            this._pendingWheelX = e.clientX;
            this._pendingWheelY = e.clientY;
            this._scheduleInputFrame();
        }, { passive: false });

        viewport.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            viewportState.isDragging = true;
            viewportState.wasDragged = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            viewportState.startX = e.clientX - viewportState.panX;
            viewportState.startY = e.clientY - viewportState.panY;
            viewport.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            if (!viewportState.isDragging) return;
            if (this._pendingDrag) {
                this.setPan(this._pendingDrag.clientX - viewportState.startX, this._pendingDrag.clientY - viewportState.startY);
                this._pendingDrag = null;
            }
            viewportState.isDragging = false;
            viewport.style.cursor = 'grab';
        });

        container.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();
        });

        window.addEventListener('dragstart', (e) => e.preventDefault());
    }
};
