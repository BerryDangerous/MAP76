import { FocusManager } from '../systems/focusManager.js';
import { FloatingCard } from '../ui/floatingCard.js';
import { MapViewport } from './viewport.js';
import { ActionButtonConfig } from '../ui/actionButton.js';
import { MarkerInteractionManager } from './markerInteraction.js';
import { DockCorner } from '../systems/dockControls.js';
import { KeybindsSystem } from '../systems/keybinds.js';
import { WorkshopList } from './workshopList.js';

let markerCardInstance: FloatingCard | null = null;

export const MarkerCard = {
    activeMarkerFormId: null as number | null,
    activeMarkerName: '',
    activeAnchorMarker: null as HTMLElement | null,
    canFastTravel: false,

    init(): void {
        FocusManager.register({
            id: 'MARKER_CARD',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('marker-card-panel');
                if (card) card.classList.add('focused');
                if (markerCardInstance) {
                    markerCardInstance.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('marker-card-panel');
                if (card) card.classList.remove('focused');
                this.updateButtonSelection();
                if (newFocusId === 'MAP' || newFocusId === 'QUEST_CARD' || newFocusId === 'QUEST_LIST' || newFocusId === 'SETTLEMENT_CARD') {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        return markerCardInstance ? markerCardInstance.handleKeyDown(e) : false;
    },

    open(title: string, markerFormId: number, canFastTravel: boolean, anchorMarker?: HTMLElement, referencePanel?: HTMLElement, dockCorner?: DockCorner, takeFocus: boolean = true, returnFocusId?: string, onNavBack?: () => void): void {
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
        if (this.canFastTravel) {
            return [
                {
                    id: 'fastTravel',
                    label: 'FAST TRAVEL',
                    action: () => {
                        if (this.activeMarkerFormId !== null) {
                            MarkerInteractionManager.initiateFastTravel(this.activeMarkerFormId, this.activeMarkerName);
                        }
                    }
                }
            ];
        } else {
            return [
                {
                    id: 'undiscovered',
                    label: 'UNDISCOVERED',
                    enabled: false,
                    action: () => {}
                }
            ];
        }
    }
};
