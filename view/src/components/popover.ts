import { MapViewport } from './viewport.js';
import { EngineBridge } from '../core/bridge.js';
import { FastTravelFailPayload } from '../types/payloads.js';
import { mapState } from '../core/state.js';
import { showCustomMarkerModal, closeCustomMarkerModal } from './customMarkerModal.js';
import { showFastTravelConfirmationModal, showFastTravelErrorModal, closeFastTravelModal } from './fastTravelModal.js';

const popoverEl = document.getElementById('map-marker-popover') as HTMLElement;
const popoverTitleEl = document.getElementById('popover-title') as HTMLElement;
const popoverBtn = document.getElementById('popover-btn') as HTMLButtonElement;

export let activeHoveredMarker: HTMLElement | null = null;
export let activeOpenedMarker: HTMLElement | null = null;
let selectedFormId: number | null = null;

export const PopoverManager = {
    initEvents() {
        const layerContainer = document.getElementById('screen-container');
        if (!layerContainer || !popoverEl) return;

        layerContainer.addEventListener('mouseover', (e: MouseEvent) => {
            if (activeOpenedMarker) return;

            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!target || target.id === 'player-marker') return;

            activeHoveredMarker = target;
            target.classList.add('is-hovered');

            MapViewport.updateViewportTransform();
        });

        layerContainer.addEventListener('mouseout', (e: MouseEvent) => {
            if (activeOpenedMarker) return;

            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (!activeHoveredMarker || target !== activeHoveredMarker) return;

            activeHoveredMarker.classList.remove('is-hovered');

            MapViewport.updateViewportTransform();
            activeHoveredMarker = null;
        });

        layerContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.marker-container') as HTMLElement;
            if (target && target.classList.contains('marker-container')) {
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

                if (popoverTitleEl) {
                    popoverTitleEl.textContent = target.dataset.displayName || '';
                }

                popoverEl.style.display = 'block';
                target.classList.add('hide-tooltip-override');

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

                MapViewport.updateViewportTransform();
                this.positionMapMarkerPopover(target);
            } else {
                if (mapState.wasDragged) return;
                const bounds = mapState.currentPayloadBounds;
                if (!bounds) return;

                this.closeActivePopover();
                const worldCoords = MapViewport.screenToGameCoords(e.clientX, e.clientY, bounds);
                showCustomMarkerModal(worldCoords, { x: e.clientX, y: e.clientY }, layerContainer as HTMLElement);
            }
        });

        popoverBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedFormId === null) return;
            
            const locationName = activeOpenedMarker?.dataset.displayName || 'location';
            showFastTravelConfirmationModal(locationName, () => {
                EngineBridge.requestFastTravel(selectedFormId!);
                this.closeActivePopover();
            });
        });

        document.addEventListener('click', (e: MouseEvent) => {
            if (popoverEl.contains(e.target as Node)) return;
            this.closeActivePopover();
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
