import { FastTravelStatus } from '@/types/map.js';
import { FastTravelFailPayload, SettlementData } from '@/types/payloads.js';
import { FastTravelCheckPayload } from '@/types/payloads.js';

import { EngineBridge } from '@/core/bridge.js';
import { mapState } from '@/core/state.js';

import { FocusManager } from '@/systems/focusManager.js';
import { getPotentialVassalMarkerFormIds } from '@/systems/markerRenderer.js';

import { MapUtils } from '@/utils/mapUtils.js';

import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { showFastTravelErrorModal } from '@/components/Modals.js';
import { showFastTravelConfirmationModal } from '@/components/Modals.js';
import { QuestCard } from '@/components/QuestCard.js';
import { SettlementCard, renderSettlementCardContent } from '@/components/SettlementCard.js';
import { isSupplyLinesViewActive } from '@/components/SupplyLines.js';

export let activeHoveredMarker: HTMLElement | null = null;
let pendingFastTravel: { formId: number, name: string } | null = null;

export const MarkerInteractionManager = {
    lastX: 0,
    lastY: 0,
    accumulatedDistance: 0,
    forceTopElement: null as HTMLElement | null,
    isTicking: false,
    lastEvent: null as MouseEvent | null,
    currentCluster: new Set<HTMLElement>(),
    clusterArray: [] as HTMLElement[],
    cycleIndex: 0,

    initiateFastTravel(formId: number, name: string) {
        pendingFastTravel = { formId, name };
        EngineBridge.checkFastTravelConditions(formId);
    },

    clearForceTop() {
        if (this.forceTopElement) {
            this.forceTopElement.classList.remove('force-top');
            this.forceTopElement = null;
        }
    },

    onMouseMove(e: MouseEvent) {
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
        if (!this.lastEvent) return;
        
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

    initEvents() {
        const layerContainer = document.getElementById('screen-container');
        if (!layerContainer) return;

        window.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: true });

        layerContainer.addEventListener('mouseover', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target || target.id === 'player-marker') return;
            
            if (target === activeHoveredMarker) return;

            EngineBridge.emitSound('UIPipBoyMapRollover');
            activeHoveredMarker = target;
            target.classList.add('is-hovered');

            const container = document.getElementById('global-nametag-container');
            const globalTag = document.getElementById('global-nametag');
            const svg = target.querySelector('svg');
            
            if (container && globalTag && target.dataset.displayName) {
                const rect = svg ? svg.getBoundingClientRect() : target.getBoundingClientRect();
                container.style.left = `${rect.left + rect.width / 2}px`;
                container.style.top = `${rect.bottom}px`;
                
                globalTag.textContent = target.dataset.displayName.replace(/-/g, '\u2011');

                if (!target.classList.contains('menu-active') && !target.classList.contains('hide-tooltip-override')) {
                    globalTag.classList.add('is-visible');
                }
            }

            if (target.dataset.isRaiderOutpost === 'true') {
                const formId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                if (formId && mapState.lastPayload) {
                    const potentialVassalIds = getPotentialVassalMarkerFormIds(formId, mapState.lastPayload);
                    
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
        });

        layerContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (target && target.classList.contains('marker-container')) {
                mapState.savedViewport = null;
                
                if (target.dataset.markerType === 'quest') {
                    e.stopPropagation();
                    const questFormId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                    const quests = mapState.lastPayload?.quests || [];
                    const matchingQuest = quests.find(q => (questFormId && q.formId === questFormId) || q.questName === target.dataset.displayName);
                    if (matchingQuest) {
                        QuestCard.open(matchingQuest, target);
                        FocusManager.setFocus('QUEST_CARD');
                        EngineBridge.emitSound('UIGeneralFocus');
                    }
                    return;
                }

                if (target.dataset.markerType === 'customMarker') {
                    e.stopPropagation();
                    CustomMarkerCard.open({ anchorMarker: target });
                    FocusManager.setFocus('CUSTOM_MARKER_CARD');
                    EngineBridge.emitSound('UIGeneralFocus');
                    return;
                }

                if (target.dataset.markerType !== 'location') {
                    return; 
                }

                e.stopPropagation();

                const canTravel = target.dataset.canFastTravel === 'true';
                const selectedFormId = target.dataset.formId ? parseInt(target.dataset.formId) : null;

                const settlements = mapState.lastPayload?.settlements;
                const ownedSettlement = settlements?.find((w: SettlementData) => w.owned && (w.markerFormId === selectedFormId || w.formId === selectedFormId || w.locationFormId === selectedFormId));

                if (ownedSettlement) {
                    renderSettlementCardContent(document.body, ownedSettlement, selectedFormId!, canTravel, target);
                    FocusManager.setFocus('SETTLEMENT_CARD');
                    EngineBridge.emitSound('UIGeneralFocus');
                    return;
                } else {
                    MarkerCard.open(target.dataset.displayName || '', selectedFormId!, canTravel, target);
                    FocusManager.setFocus('MARKER_CARD');
                    EngineBridge.emitSound('UIGeneralFocus');
                }
            } else {
                if (mapState.wasDragged) return;
                const config = mapState.activeMapConfig;
                const bounds = mapState.lastPayload?.worldspaces?.[config.worldspaceID]?.bounds;
                if (!bounds) return;

                if (FocusManager.getFocus() !== 'MAP') {
                    FocusManager.setFocus('MAP');
                    return;
                }

                if (isSupplyLinesViewActive()) {
                    return;
                }

                const worldCoords = MapUtils.screenToGameCoords(e.clientX, e.clientY, bounds, mapState.activeMapConfig!.gutters!, mapState.zoom, mapState.panX, mapState.panY);
                CustomMarkerCard.open({ gameCoords: worldCoords, pageCoords: { x: e.clientX, y: e.clientY }, worldspaceId: config.worldspaceID });
                FocusManager.setFocus('CUSTOM_MARKER_CARD');
            }
        });

        window.addEventListener('FastTravelCheckResult', (e: Event) => {
            if (!pendingFastTravel) return;
            const detail = (e as CustomEvent<FastTravelCheckPayload>).detail;
            
            if (detail.status === FastTravelStatus.SUCCESS) {
                const { formId, name } = pendingFastTravel;
                showFastTravelConfirmationModal(name, () => {
                    EngineBridge.requestFastTravel(formId);
                    if (FocusManager.getFocus() === 'MARKER_CARD') {
                        MarkerCard.close();
                    } else if (FocusManager.getFocus() === 'SETTLEMENT_CARD') {
                        SettlementCard.close();
                    }
                });
            } else {
                showFastTravelErrorModal(detail.status);
            }
            pendingFastTravel = null;
        });

        window.addEventListener('FastTravelFailed', (e: Event) => {
            const detail = (e as CustomEvent<FastTravelFailPayload>).detail;
            showFastTravelErrorModal(detail.status);
        });
    }
};
