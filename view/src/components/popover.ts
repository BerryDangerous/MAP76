import { MapViewport } from './viewport.js';
import { EngineBridge } from '../core/bridge.js';
import { FastTravelFailPayload, SettlementData } from '../types/payloads.js';
import { mapState } from '../core/state.js';
import { showCustomMarkerModal } from './customMarkerModal.js';
import { showFastTravelConfirmationModal, showFastTravelErrorModal, closeFastTravelModal } from './fastTravelModal.js';
import { renderSettlementCardContent } from './settlementCard.js';
import { isSupplyLinesViewActive } from './supplyLines.js';
import { getPotentialVassalMarkerFormIds } from './markers.js';
import { QuestCard } from './questCard.js';
import { FocusManager } from '../systems/focusManager.js';

const popoverEl = document.getElementById('map-marker-popover') as HTMLElement;
let popoverTitleEl: HTMLElement | null = null;
let popoverBtn: HTMLButtonElement | null = null;

export let activeHoveredMarker: HTMLElement | null = null;
export let activeOpenedMarker: HTMLElement | null = null;
let selectedFormId: number | null = null;

function resetPopoverHTML(): void {
    popoverEl.innerHTML = `
        <h3 id="popover-title"></h3>
        <button id="popover-btn">FAST TRAVEL</button>
    `;
    popoverTitleEl = document.getElementById('popover-title') as HTMLElement;
    popoverBtn = document.getElementById('popover-btn') as HTMLButtonElement;

    popoverBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedFormId === null) return;
        
        const locationName = activeOpenedMarker?.dataset.displayName || 'location';
        showFastTravelConfirmationModal(locationName, () => {
            EngineBridge.requestFastTravel(selectedFormId!);
            PopoverManager.closeActivePopover();
        });
    });
}

export const PopoverManager = {
    initEvents() {
        const layerContainer = document.getElementById('screen-container');
        if (!layerContainer || !popoverEl) return;

        resetPopoverHTML();

        layerContainer.addEventListener('mouseover', (e: MouseEvent) => {
            if (activeOpenedMarker) return;

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
            if (activeOpenedMarker) return;

            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!activeHoveredMarker || target !== activeHoveredMarker) return;

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

            if (target !== QuestCard.activeAnchorMarker) {
                activeHoveredMarker.classList.remove('is-hovered');
            }

            MapViewport.updateViewportTransform();
            activeHoveredMarker = null;
        });

        layerContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (target && target.classList.contains('marker-container')) {
                if (target.dataset.markerType === 'quest') {
                    e.stopPropagation();
                    this.closeActivePopover();
                    const questFormId = target.dataset.formId ? parseInt(target.dataset.formId) : null;
                    const quests = mapState.lastPayload?.quests || [];
                    const matchingQuest = quests.find(q => (questFormId && q.formId === questFormId) || q.questName === target.dataset.displayName);
                    if (matchingQuest) {
                        QuestCard.open(matchingQuest, target);
                        FocusManager.setFocus('QUEST_CARD');
                    }
                    return;
                }

                if (target.dataset.markerType !== 'location') {
                    return; 
                }

                e.stopPropagation();

                const canTravel = target.dataset.canFastTravel === 'true';
                selectedFormId = target.dataset.formId ? parseInt(target.dataset.formId) : null;

                if (activeOpenedMarker) {
                    activeOpenedMarker.classList.remove('menu-active');
                }
                activeOpenedMarker = target;

                target.classList.remove('is-hovered');
                target.classList.add('menu-active');

                popoverEl.style.display = 'block';
                target.classList.add('hide-tooltip-override');

                const settlements = mapState.lastPayload?.settlements;
                const ownedSettlement = settlements?.find((w: SettlementData) => w.owned && (w.markerFormId === selectedFormId || w.formId === selectedFormId || w.locationFormId === selectedFormId));

                if (ownedSettlement) {
                    renderSettlementCardContent(popoverEl, ownedSettlement, selectedFormId!, canTravel);
                } else {
                    resetPopoverHTML();
                    if (popoverTitleEl) {
                        popoverTitleEl.textContent = target.dataset.displayName || '';
                    }

                    if (popoverBtn) {
                        if (canTravel) {
                            popoverBtn.disabled = false;
                            popoverBtn.style.opacity = '1.0';
                            popoverBtn.innerText = "FAST TRAVEL";
                        } else {
                            popoverBtn.disabled = true;
                            popoverBtn.style.opacity = '0.4';
                            popoverBtn.innerText = "UNDISCOVERED";
                        }
                    }
                }

                MapViewport.updateViewportTransform();
                this.positionMapMarkerPopover(target);
            } else {
                if (mapState.wasDragged) return;
                const bounds = mapState.currentPayloadBounds;
                if (!bounds) return;

                this.closeActivePopover();
                QuestCard.close();

                if (isSupplyLinesViewActive()) {
                    return;
                }

                const worldCoords = MapViewport.screenToGameCoords(e.clientX, e.clientY, bounds);
                showCustomMarkerModal(worldCoords, { x: e.clientX, y: e.clientY }, layerContainer as HTMLElement);
            }
        });

        window.addEventListener('FastTravelFailed', (e: Event) => {
            const detail = (e as CustomEvent<FastTravelFailPayload>).detail;
            showFastTravelErrorModal(detail.status);
        });

        window.repositionActivePopover = () => {
            if (activeOpenedMarker && popoverEl.style.display === 'block') {
                this.positionMapMarkerPopover(activeOpenedMarker);
            }
        };

        window.closeActivePopover = () => this.closeActivePopover();
    },

    closeActivePopover() {
        if (!popoverEl || (popoverEl.style.display === 'none' && !activeOpenedMarker)) return;
        popoverEl.style.display = 'none';

        if (activeOpenedMarker) {
            activeOpenedMarker.classList.remove('menu-active');
            activeOpenedMarker.classList.remove('is-hovered');
            activeOpenedMarker.classList.remove('hide-tooltip-override');
        }

        activeOpenedMarker = null;
        activeHoveredMarker = null;
        selectedFormId = null;
        closeFastTravelModal();
        MapViewport.updateViewportTransform();
    },

    positionMapMarkerPopover(marker: HTMLElement) {
        if (!marker || !popoverEl) return;

        const imgEl = marker.querySelector('img');
        const mRect = imgEl ? imgEl.getBoundingClientRect() : marker.getBoundingClientRect();

        const pWidth = popoverEl.offsetWidth;
        const pHeight = popoverEl.offsetHeight;
        const gap = 24;

        const markerCenterX = mRect.left + (mRect.width / 2);
        const markerCenterY = mRect.top + (mRect.height / 2);

        const options = [
            { left: mRect.right + gap, top: markerCenterY - (pHeight / 2) },
            { left: mRect.left - pWidth - gap, top: markerCenterY - (pHeight / 2) },
            { left: markerCenterX - (pWidth / 2), top: mRect.top - pHeight - gap },
            { left: markerCenterX - (pWidth / 2), top: mRect.bottom + gap },
            { left: mRect.right + gap, top: mRect.top - pHeight },
            { left: mRect.left - pWidth - gap, top: mRect.top - pHeight },
            { left: mRect.right + gap, top: mRect.bottom },
            { left: mRect.left - pWidth - gap, top: mRect.bottom }
        ];

        let chosenCoordinates = options[0];
        for (const pos of options) {
            if (
                pos.left >= 0 &&
                pos.top >= 0 &&
                pos.left + pWidth <= window.innerWidth &&
                pos.top + pHeight <= window.innerHeight
            ) {
                chosenCoordinates = pos;
                break;
            }
        }

        popoverEl.style.left = `${chosenCoordinates.left}px`;
        popoverEl.style.top = `${chosenCoordinates.top}px`;
    }
};
