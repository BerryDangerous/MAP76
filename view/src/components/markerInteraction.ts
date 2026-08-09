import { MapViewport } from './viewport.js';
import { EngineBridge } from '../core/bridge.js';
import { FastTravelFailPayload, SettlementData } from '../types/payloads.js';
import { mapState } from '../core/state.js';
import { showFastTravelErrorModal } from './appModals.js';
import { SettlementCard, renderSettlementCardContent } from './settlementCard.js';
import { MarkerCard } from './markerCard.js';
import { CustomMarkerCard } from './customMarkerCard.js';
import { isSupplyLinesViewActive } from './supplyLines.js';
import { getPotentialVassalMarkerFormIds } from './markers.js';
import { QuestCard } from './questCard.js';
import { FocusManager } from '../systems/focusManager.js';
import { FastTravelCheckPayload } from '../types/payloads.js';
import { FastTravelStatus } from '../types/map.js';
import { showFastTravelConfirmationModal } from './appModals.js';

export let activeHoveredMarker: HTMLElement | null = null;
let pendingFastTravel: { formId: number, name: string } | null = null;

export const MarkerInteractionManager = {
    initiateFastTravel(formId: number, name: string) {
        pendingFastTravel = { formId, name };
        EngineBridge.checkFastTravelConditions(formId);
    },

    initEvents() {
        const layerContainer = document.getElementById('screen-container');
        if (!layerContainer) return;

        layerContainer.addEventListener('mouseover', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target || target.id === 'player-marker') return;

            activeHoveredMarker = target;
            target.classList.add('is-hovered');

            if (target.dataset.isRaiderOutpost === 'true') {
                const formId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                if (formId && mapState.lastPayload) {
                    const potentialVassalIds = getPotentialVassalMarkerFormIds(formId, mapState.lastPayload);
                    
                    document.querySelectorAll('.marker-container').forEach(el => {
                        const markerEl = el as HTMLElement;
                        const mFormId = markerEl.dataset.formId ? parseInt(markerEl.dataset.formId) : null;
                        if (mFormId && potentialVassalIds.has(mFormId)) {
                            const img = markerEl.querySelector('img');
                            if (img && markerEl.dataset.potentialVassalIconUrl) {
                                img.src = markerEl.dataset.potentialVassalIconUrl;
                                markerEl.classList.add('is-potential-vassal');
                            }
                        }
                    });
                }
            }

            MapViewport.updateViewportTransform();
        });

        layerContainer.addEventListener('mouseout', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target) return;

            const related = e.relatedTarget as HTMLElement | null;
            if (related && target.contains(related)) return;

            if (target.dataset.isRaiderOutpost === 'true') {
                document.querySelectorAll('.marker-container.is-potential-vassal').forEach(el => {
                    const markerEl = el as HTMLElement;
                    const img = markerEl.querySelector('img');
                    if (img && markerEl.dataset.defaultIconUrl) {
                        img.src = markerEl.dataset.defaultIconUrl;
                    }
                    markerEl.classList.remove('is-potential-vassal');
                });
            }

            target.classList.remove('is-hovered');

            MapViewport.updateViewportTransform();
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
                    }
                    return;
                }

                if (target.dataset.markerType === 'customMarker') {
                    e.stopPropagation();
                    CustomMarkerCard.openForExisting(target);
                    FocusManager.setFocus('CUSTOM_MARKER_CARD');
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
                    return;
                } else if (canTravel) {
                    MarkerCard.open(target.dataset.displayName || '', selectedFormId!, canTravel, target);
                    FocusManager.setFocus('MARKER_CARD');
                }
            } else {
                if (mapState.wasDragged) return;
                const bounds = mapState.currentPayloadBounds;
                if (!bounds) return;

                if (FocusManager.getFocus() !== 'MAP') {
                    FocusManager.setFocus('MAP');
                    return;
                }

                if (isSupplyLinesViewActive()) {
                    return;
                }

                const worldCoords = MapViewport.screenToGameCoords(e.clientX, e.clientY, bounds);
                CustomMarkerCard.openForPlacement(worldCoords, { x: e.clientX, y: e.clientY });
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
