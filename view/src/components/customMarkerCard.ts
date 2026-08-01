import { FocusManager } from '../systems/focusManager.js';
import { FloatingCard } from '../ui/floatingCard.js';
import { ActionButtonConfig } from '../ui/actionButton.js';
import { MapViewport } from './viewport.js';
import { setCustomMarker, removeCustomMarker } from '../core/bridge.js';

let customMarkerCardInstance: FloatingCard | null = null;

export const CustomMarkerCard = {
    activeCoords: null as { x: number, y: number } | null,
    activeGameCoords: null as { x: number, y: number } | null,
    activeAnchorMarker: null as HTMLElement | null,

    init(): void {
        FocusManager.register({
            id: 'CUSTOM_MARKER_CARD',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('custom-marker-card-panel');
                if (card) card.classList.add('focused');
                if (customMarkerCardInstance) {
                    customMarkerCardInstance.getButtonGroup().setSelectedIndex(0);
                }
            },
            onFocusLost: () => {
                const card = document.getElementById('custom-marker-card-panel');
                if (card) card.classList.remove('focused');
                if (customMarkerCardInstance && customMarkerCardInstance.isOpen()) {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (e.key === 'Escape' || e.key === 'Tab') {
            FocusManager.setFocus('MAP');
            return true;
        }

        if (customMarkerCardInstance) {
            const buttonGroup = customMarkerCardInstance.getButtonGroup();
            if (e.key === 'ArrowDown') {
                buttonGroup.navigateNext();
                return true;
            }

            if (e.key === 'ArrowUp') {
                buttonGroup.navigatePrev();
                return true;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                buttonGroup.triggerSelected();
                return true;
            }
        }
        return false;
    },

    openForExisting(anchorMarker: HTMLElement): void {
        this.activeAnchorMarker = anchorMarker;
        this.activeCoords = null;
        this.activeGameCoords = null;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        if (!customMarkerCardInstance) {
            customMarkerCardInstance = new FloatingCard({
                id: 'custom-marker-card-panel',
                title: 'Custom Marker',
                buttons: this.buildButtonsForExisting(),
                anchorMarker: anchorMarker
            });
        } else {
            customMarkerCardInstance.update({
                title: 'Custom Marker',
                buttons: this.buildButtonsForExisting(),
                anchorMarker: anchorMarker,
                coords: undefined
            });
        }

        customMarkerCardInstance.open(anchorMarker);
    },

    openForPlacement(gameCoords: { x: number, y: number }, pageCoords: { x: number, y: number }): void {
        this.activeAnchorMarker = null;
        this.activeCoords = pageCoords;
        this.activeGameCoords = gameCoords;

        const hasExistingMarker = Boolean(document.querySelector('.custom-marker'));
        const title = 'Custom Marker';

        if (!customMarkerCardInstance) {
            customMarkerCardInstance = new FloatingCard({
                id: 'custom-marker-card-panel',
                title: title,
                buttons: this.buildButtonsForPlacement(hasExistingMarker),
                coords: pageCoords
            });
        } else {
            customMarkerCardInstance.update({
                title: title,
                buttons: this.buildButtonsForPlacement(hasExistingMarker),
                anchorMarker: null,
                coords: pageCoords
            });
        }

        customMarkerCardInstance.open(undefined);
    },

    buildButtonsForExisting(): ActionButtonConfig[] {
        return [
            {
                id: 'removeMarker',
                label: 'REMOVE MARKER',
                action: () => {
                    removeCustomMarker();
                    this.close();
                }
            }
        ];
    },

    buildButtonsForPlacement(hasExistingMarker: boolean): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [
            {
                id: 'placeMarker',
                label: hasExistingMarker ? 'MOVE MARKER' : 'PLACE MARKER',
                action: () => {
                    if (this.activeGameCoords) {
                        setCustomMarker(this.activeGameCoords.x, this.activeGameCoords.y);
                    }
                    this.close();
                }
            }
        ];

        if (hasExistingMarker) {
            buttons.push({
                id: 'removeMarker',
                label: 'REMOVE MARKER',
                action: () => {
                    removeCustomMarker();
                    this.close();
                }
            });
        }

        return buttons;
    },

    close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('is-hovered');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            MapViewport.updateViewportTransform();
        }

        this.activeCoords = null;
        this.activeGameCoords = null;

        if (customMarkerCardInstance) {
            customMarkerCardInstance.close();
        }

        if (FocusManager.getFocus() === 'CUSTOM_MARKER_CARD') {
            FocusManager.setFocus('MAP');
        }
    },

    isOpen(): boolean {
        return customMarkerCardInstance ? customMarkerCardInstance.isOpen() : false;
    }
};
