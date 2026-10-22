import { MarkerKind, ScreenAnchor } from '@/types/seams.js';

import { domainState } from '@/core/state/index.js';

import { SoundService } from '@/services/soundService.js';

import { viewportState } from '@/map/viewportState.js';
import { screenToGameCoords } from '@/map/coordinates.js';
import { isSupplyLinesViewActive } from '@/map/supplyLines.js';
import { getPotentialVassalMarkerFormIds } from '@/map/markers.js';
import type { MapSurface } from '@/map/mapSurface.js';

export let activeHoveredMarker: HTMLElement | null = null;

export const MarkerInteractionManager = {
    _surface: null as MapSurface | null,
    _containerEl: null as HTMLElement | null,

    lastX: 0,
    lastY: 0,
    accumulatedDistance: 0,
    forceTopElement: null as HTMLElement | null,
    isTicking: false,
    lastEvent: null as MouseEvent | null,
    currentCluster: new Set<HTMLElement>(),
    clusterArray: [] as HTMLElement[],
    cycleIndex: 0,

    bindSurface(surface: MapSurface, containerEl?: HTMLElement | null) {
        this._surface = surface;
        this._containerEl = containerEl ?? null;
    },

    initiateFastTravel(formId: number, name: string) {
        const activeWsId = this._surface ? this._surface.getActiveConfig().worldspaceID : domainState.getActiveWorldspaceID();
        this._surface?.events.emit('fastTravelRequest', {
            formId,
            name,
            worldspaceId: activeWsId
        });
    },

    clearForceTop() {
        if (this.forceTopElement) {
            this.forceTopElement.classList.remove('force-top');
            this.forceTopElement = null;
        }
    },

    onMouseMove(e: MouseEvent) {
        if (viewportState.isDragging) return;
        this.lastEvent = e;
        if (!this.isTicking) {
            window.requestAnimationFrame(() => {
                this.processMouseMove();
                this.isTicking = false;
            });
            this.isTicking = true;
        }
    },

    processMouseMove() {
        if (!this.lastEvent || viewportState.isDragging) return;
        
        const markers = this.getHoveredMarkers(this.lastEvent.clientX, this.lastEvent.clientY);

        if (this.isHoveringSingleOrNoMarker(markers)) {
            this.resetClusterState();
            return;
        }

        const distanceMoved = this.calculateMouseMovement(this.lastEvent.clientX, this.lastEvent.clientY);
        
        this.updateLastMousePosition(this.lastEvent.clientX, this.lastEvent.clientY);

        if (this.isMouseTeleported(distanceMoved)) {
            this.accumulatedDistance = 0;
            return;
        }

        this.accumulatedDistance += distanceMoved;

        if (this.hasClusterChanged(markers)) {
            this.initializeNewCluster(markers);
        }

        if (this.isCycleThresholdMet()) {
            this.cycleToNextMarker();
        }
    },

    getHoveredMarkers(clientX: number, clientY: number): HTMLElement[] {
        return document.elementsFromPoint(clientX, clientY)
            .map(el => el.closest('.marker-container') || (el.id === 'player-marker' ? el : null))
            .filter((el, idx, arr) => el && arr.indexOf(el) === idx) as HTMLElement[];
    },

    isHoveringSingleOrNoMarker(markers: HTMLElement[]): boolean {
        return markers.length < 2;
    },

    resetClusterState() {
        this.accumulatedDistance = 0;
        this.currentCluster.clear();
        this.clusterArray = [];
        this.clearForceTop();
    },

    calculateMouseMovement(clientX: number, clientY: number): number {
        const dx = clientX - this.lastX;
        const dy = clientY - this.lastY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    updateLastMousePosition(clientX: number, clientY: number) {
        this.lastX = clientX;
        this.lastY = clientY;
    },

    isMouseTeleported(distanceMoved: number): boolean {
        return distanceMoved > 50;
    },

    hasClusterChanged(newMarkers: HTMLElement[]): boolean {
        const newSet = new Set(newMarkers);
        
        if (newSet.size !== this.currentCluster.size) {
            return true;
        }
        
        for (const marker of newMarkers) {
            if (!this.currentCluster.has(marker)) {
                return true;
            }
        }
        
        return false;
    },

    initializeNewCluster(newMarkers: HTMLElement[]) {
        this.currentCluster = new Set(newMarkers);
        this.clusterArray = newMarkers;
        this.cycleIndex = 0;
        this.clearForceTop();
    },

    isCycleThresholdMet(): boolean {
        const dynamicThreshold = window.innerHeight * 0.02;
        return this.accumulatedDistance >= dynamicThreshold;
    },

    cycleToNextMarker() {
        this.accumulatedDistance = 0;
        this.cycleIndex = (this.cycleIndex + 1) % this.clusterArray.length;
        
        this.clearForceTop();
        this.forceTopElement = this.clusterArray[this.cycleIndex];
        
        if (this.forceTopElement) {
            this.forceTopElement.classList.add('force-top');
        }
    },

    _getScreenAnchor(element: HTMLElement): ScreenAnchor {
        const svg = element.querySelector('svg');
        const rect = svg ? svg.getBoundingClientRect() : element.getBoundingClientRect();
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    },

    initEvents() {
        const layerContainer = this._containerEl ?? document.getElementById('screen-container');
        if (!layerContainer) return;

        window.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });

        layerContainer.addEventListener('mouseover', (e: MouseEvent) => {
            if (viewportState.isDragging) return;

            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target || target.id === 'player-marker') return;
            
            if (target === activeHoveredMarker) return;

            SoundService.playMarkerHover();
            activeHoveredMarker = target;
            target.classList.add('is-hovered');

            const container = document.getElementById('global-nametag-container');
            const globalTag = document.getElementById('global-nametag');
            const svg = target.querySelector('svg');
            
            if (container && globalTag && target.dataset.displayName) {
                globalTag.textContent = target.dataset.displayName.replace(/-/g, '\u2011');

                if (!target.classList.contains('menu-active') && !target.classList.contains('hide-tooltip-override')) {
                    globalTag.classList.add('is-visible');
                }

                requestAnimationFrame(() => {
                    if (activeHoveredMarker === target) {
                        const rect = svg ? svg.getBoundingClientRect() : target.getBoundingClientRect();
                        container.style.left = `${rect.left + rect.width / 2}px`;
                        container.style.top = `${rect.bottom}px`;
                    }
                });
            }

            if (target.dataset.isRaiderOutpost === 'true') {
                const formId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                if (formId) {
                    const potentialVassalIds = getPotentialVassalMarkerFormIds(
                        formId,
                        domainState.settlements,
                        domainState.markers,
                        domainState.lastPayload?.dlc04VassalDistance
                    );
                    
                    document.querySelectorAll('.marker-container').forEach(el => {
                        const markerEl = el as HTMLElement;
                        const mFormId = markerEl.dataset.formId ? parseInt(markerEl.dataset.formId) : null;
                        if (mFormId && potentialVassalIds.has(mFormId)) {
                            if (markerEl.dataset.potentialVassalIconSvg) {
                                markerEl.innerHTML = markerEl.dataset.potentialVassalIconSvg;
                                markerEl.classList.add('is-potential-vassal');
                            }
                        }
                    });
                }
            }

            const kind = target.dataset.markerType === 'quest' ? MarkerKind.QUEST :
                         target.dataset.markerType === 'customMarker' ? MarkerKind.CUSTOM :
                         target.dataset.markerType === 'powerArmor' ? MarkerKind.POWER_ARMOR : MarkerKind.POI;
            this._surface?.events.emit('markerHover', {
                kind,
                name: target.dataset.displayName || '',
                formId: target.dataset.formId ? parseInt(target.dataset.formId) : undefined,
                anchor: this._getScreenAnchor(target)
            });
        });

        layerContainer.addEventListener('mouseout', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target) return;

            const related = e.relatedTarget as HTMLElement | null;
            if (related && target.contains(related)) return;

            if (target.dataset.isRaiderOutpost === 'true') {
                document.querySelectorAll('.marker-container.is-potential-vassal').forEach(el => {
                    const markerEl = el as HTMLElement;
                    if (markerEl.dataset.defaultIconSvg) {
                        markerEl.innerHTML = markerEl.dataset.defaultIconSvg;
                    }
                    markerEl.classList.remove('is-potential-vassal');
                });
            }

            target.classList.remove('is-hovered');
            
            const globalTag = document.getElementById('global-nametag');
            if (globalTag) {
                globalTag.classList.remove('is-visible');
            }

            if (activeHoveredMarker === target) {
                activeHoveredMarker = null;
            }

            this._surface?.events.emit('markerHover', null);
        });

        layerContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (target && target.classList.contains('marker-container')) {
                viewportState.savedViewport = null;
                e.stopPropagation();

                const anchor = this._getScreenAnchor(target);
                const activeWsId = this._surface ? this._surface.getActiveConfig().worldspaceID : domainState.getActiveWorldspaceID();

                if (target.dataset.markerType === 'quest') {
                    const questFormId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                    let matchingQuest = questFormId ? domainState.quests.get(questFormId) : undefined;
                    if (!matchingQuest) {
                        for (const q of domainState.quests.values()) {
                            if (q.questName === target.dataset.displayName) {
                                matchingQuest = q;
                                break;
                            }
                        }
                    }
                    const qId = matchingQuest ? matchingQuest.formId : (questFormId ?? 0);
                    this._surface?.events.emit('markerSelect', {
                        kind: MarkerKind.QUEST,
                        questFormId: qId,
                        worldspaceId: activeWsId,
                        anchor
                    });
                    return;
                }

                if (target.dataset.markerType === 'customMarker') {
                    this._surface?.events.emit('markerSelect', {
                        kind: MarkerKind.CUSTOM,
                        worldspaceId: activeWsId,
                        coordinates: { x: 0, y: 0 },
                        anchor
                    });
                    return;
                }

                if (target.dataset.markerType === 'powerArmor') {
                    this._surface?.events.emit('markerSelect', {
                        kind: MarkerKind.POWER_ARMOR,
                        worldspaceId: activeWsId,
                        coordinates: { x: 0, y: 0, z: 0 },
                        anchor
                    });
                    return;
                }

                if (target.dataset.markerType === 'location') {
                    const selectedFormId = target.dataset.formId ? parseInt(target.dataset.formId) : 0;
                    this._surface?.events.emit('markerSelect', {
                        kind: MarkerKind.POI,
                        formId: selectedFormId,
                        worldspaceId: activeWsId,
                        anchor
                    });
                    return;
                }
            } else {
                if (viewportState.wasDragged) return;
                const config = this._surface?.getActiveConfig();
                if (!config) return;
                const bounds = domainState.worldspaces.get(config.worldspaceID)?.bounds;
                if (!bounds) return;

                if (isSupplyLinesViewActive()) {
                    return;
                }

                e.stopPropagation();
                const gutters = config.gutters ?? { left: 0, right: 0, top: 0, bottom: 0 };
                const worldCoords = screenToGameCoords(e.clientX, e.clientY, bounds, gutters, viewportState.zoom, viewportState.panX, viewportState.panY, config.cellBounds);
                this._surface?.events.emit('emptyMapClick', {
                    worldCoordinates: worldCoords,
                    screenCoordinates: { x: e.clientX, y: e.clientY },
                    worldspaceId: config.worldspaceID
                });
            }
        });
    }
};
