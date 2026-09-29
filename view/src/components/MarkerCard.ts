import { mapState } from '@/core/state.js';
import { EngineBridge, toggleFavoriteLocation, setCustomMarker } from '@/core/bridge.js';

import { FocusManager } from '@/systems/focusManager.js';
import { LocationsList } from './WorkshopsPanel.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { Corner } from '@/systems/layoutManager.js';
import { MarkerInteractionManager } from '@/systems/markerController.js';
import { MapViewport } from '@/systems/viewport.js';

import { t } from '@/core/i18n.js';

import { ActionButtonConfig } from '@/components/ui/ButtonGroup.js';
import { FloatingCard } from '@/components/ui/FloatingCard.js';

let markerCardInstance: FloatingCard | null = null;

export const MarkerCard = {
    activeMarkerFormId: null as number | null,
    activeMarkerName: '',
    activeAnchorMarker: null as HTMLElement | null,
    canFastTravel: false,

    init(): void {
        FocusManager.register({
            id: 'MARKER_CARD',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK'];
                const buttons = MarkerCard.buildButtonConfigs();
                if (buttons.length > 1) {
                    controls.push('NAV_UP', 'NAV_DOWN');
                }
                controls.push('PAN_MOUSE');
                if (MarkerCard.activeAnchorMarker === null && MarkerCard.activeMarkerFormId !== null) {
                    controls.push({ action: 'CENTER_ITEM', label: t('markers.controls.centerMarker') });
                }
                if (buttons.length > 0) {
                    controls.push('SELECT');
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('marker-card-panel');
                if (card) card.classList.add('focused');
                if (markerCardInstance) {
                    markerCardInstance.setReferencePanelDimmed(true);
                    markerCardInstance.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('marker-card-panel');
                if (card) card.classList.remove('focused');
                if (markerCardInstance) {
                    markerCardInstance.setReferencePanelDimmed(false);
                }
                this.updateButtonSelection();
                if (newFocusId === 'MAP' || newFocusId === 'QUEST_CARD' || newFocusId === 'QUEST_LIST' || newFocusId === 'SETTLEMENT_CARD') {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            if (this.activeAnchorMarker === null && this.activeMarkerFormId !== null) {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                const marker = mapState.lastPayload?.markers?.find(m => m.formId === this.activeMarkerFormId);
                if (marker) {
                    MapViewport.centerOnTarget(marker.worldspace, marker.x, marker.y, 0);
                }
                return true;
            }
        }
        return markerCardInstance ? markerCardInstance.handleKeyDown(e) : false;
    },

    open(title: string, markerFormId: number, canFastTravel: boolean, anchorMarker?: HTMLElement, referencePanel?: HTMLElement, dockCorner?: Corner, takeFocus: boolean = true, returnFocusId?: string, onNavBack?: () => void): void {
        if (this.activeAnchorMarker && this.activeAnchorMarker !== anchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
        }

        this.activeMarkerName = title;
        this.activeMarkerFormId = markerFormId;
        this.canFastTravel = canFastTravel;
        this.activeAnchorMarker = anchorMarker || null;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        const buttons = this.buildButtonConfigs();

        if (!markerCardInstance) {
            markerCardInstance = new FloatingCard({
                id: 'marker-card-panel',
                title: title,
                buttons: buttons,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            markerCardInstance.update({
                title: title,
                bodyHtml: '',
                buttons: buttons,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack
            });
        }

        markerCardInstance.open(this.activeAnchorMarker || undefined, referencePanel, dockCorner);
        if (takeFocus) {
            FocusManager.setFocus('MARKER_CARD');
        }
        this.updateButtonSelection();
    },

    close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('is-hovered');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            MapViewport.updateViewportTransform();
        }

        if (markerCardInstance) {
            markerCardInstance.close();
        }

        if (FocusManager.getFocus() === 'MARKER_CARD') {
            FocusManager.setFocus('MAP');
        }
    },

    positionNearMarker(): void {
        if (markerCardInstance) {
            markerCardInstance.updatePosition();
        }
    },

    isOpen(): boolean {
        return !!markerCardInstance && markerCardInstance.isOpen();
    },

    updateButtonSelection(): void {
        if (!markerCardInstance) return;

        const card = markerCardInstance.getElement();
        if (!card) return;

        const isCardFocused = FocusManager.getFocus() === 'MARKER_CARD';
        const buttons = card.querySelectorAll('.fc-action-btn');
        const selectedIdx = markerCardInstance.getButtonGroup().getSelectedIndex();

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === selectedIdx) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    },

    buildButtonConfigs(): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];

        if (this.canFastTravel) {
            buttons.push({
                id: 'fastTravel',
                label: t('markers.controls.fastTravel'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        MarkerInteractionManager.initiateFastTravel(this.activeMarkerFormId, this.activeMarkerName);
                    }
                }
            });
        } else {
            buttons.push({
                id: 'undiscovered',
                label: t('markers.controls.undiscovered'),
                enabled: false,
                action: () => {}
            });
        }

        if (this.activeMarkerFormId !== null) {
            const isFav = mapState.lastPayload?.favoriteLocations?.includes(this.activeMarkerFormId);
            buttons.push({
                id: 'favorite',
                label: isFav ? t('locations.controls.unfavorite') : t('locations.controls.favorite'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        toggleFavoriteLocation(this.activeMarkerFormId);
                        
                        if (mapState.lastPayload) {
                            if (!mapState.lastPayload.favoriteLocations) {
                                mapState.lastPayload.favoriteLocations = [];
                            }
                            if (isFav) {
                                mapState.lastPayload.favoriteLocations = mapState.lastPayload.favoriteLocations.filter(id => id !== this.activeMarkerFormId);
                            } else {
                                mapState.lastPayload.favoriteLocations.push(this.activeMarkerFormId);
                            }
                        }
                        
                        MarkerCard.open(
                            MarkerCard.activeMarkerName,
                            MarkerCard.activeMarkerFormId as number,
                            MarkerCard.canFastTravel,
                            MarkerCard.activeAnchorMarker || undefined,
                            undefined, undefined, false
                        );
                        
                        LocationsList.render();
                    }
                }
            });
        }

        const hasExistingMarker = Boolean(document.querySelector('.custom-marker'));
        buttons.push({
            id: 'placeMarker',
            label: hasExistingMarker ? t('markers.customMarker.moveMarker') : t('markers.customMarker.placeMarker'),
            action: () => {
                if (this.activeMarkerFormId !== null) {
                    const marker = mapState.lastPayload?.markers?.find(m => m.formId === this.activeMarkerFormId);
                    if (marker) {
                        setCustomMarker(marker.x, marker.y, marker.worldspace);
                    }
                }
            }
        });
        return buttons;
    }
};

window.addEventListener('languageChanged', () => {
    if (MarkerCard.isOpen() && MarkerCard.activeMarkerFormId !== null) {
        MarkerCard.open(
            MarkerCard.activeMarkerName, 
            MarkerCard.activeMarkerFormId as number, 
            MarkerCard.canFastTravel, 
            MarkerCard.activeAnchorMarker || undefined, 
            undefined, undefined, false
        );
    }
});
