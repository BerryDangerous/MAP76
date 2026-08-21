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
    activeWorldspaceId: undefined as number | undefined,

    init(): void {
        FocusManager.register({
            id: 'CUSTOM_MARKER_CARD',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', 'PAN_MOUSE'];
                if (CustomMarkerCard.activeAnchorMarker === null && (CustomMarkerCard.activeGameCoords || CustomMarkerCard.activeCoords)) {
                    controls.push({ action: 'CENTER_ITEM', label: 'CENTER MARKER' });
                }
                return controls;
            },
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
        return customMarkerCardInstance ? customMarkerCardInstance.handleKeyDown(e) : false;
    },

    open(options: {
        anchorMarker?: HTMLElement | null;
        gameCoords?: { x: number, y: number } | null;
        pageCoords?: { x: number, y: number } | null;
        worldspaceId?: number;
        returnFocusId?: string;
        onNavBack?: () => void;
    }): void {
        this.activeAnchorMarker = options.anchorMarker || null;
        this.activeCoords = options.pageCoords || null;
        this.activeGameCoords = options.gameCoords || null;
        this.activeWorldspaceId = options.worldspaceId;

        const isClickingExisting = Boolean(this.activeAnchorMarker);
        const hasExistingMarker = Boolean(document.querySelector('.custom-marker'));

        let title = 'Place a marker?';
        if (isClickingExisting) {
            title = 'Remove your current marker?';
        } else if (hasExistingMarker) {
            title = 'Move your current marker or remove it?';
        }

        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.add('menu-active');
            this.activeAnchorMarker.classList.add('hide-tooltip-override');
        }

        const buttons = this.buildButtons(isClickingExisting, hasExistingMarker);

        const cardConfig = {
            id: 'custom-marker-card-panel',
            title: title,
            buttons: buttons,
            anchorMarker: this.activeAnchorMarker || null,
            coords: this.activeCoords || undefined,
            returnFocusId: options.returnFocusId,
            onNavBack: options.onNavBack
        };

        if (!customMarkerCardInstance) {
            customMarkerCardInstance = new FloatingCard(cardConfig);
        } else {
            customMarkerCardInstance.update(cardConfig);
        }

        customMarkerCardInstance.open(this.activeAnchorMarker || undefined);
    },

    buildButtons(isClickingExisting: boolean, hasExistingMarker: boolean): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];

        if (!isClickingExisting) {
            buttons.push({
                id: 'placeMarker',
                label: hasExistingMarker ? 'MOVE MARKER' : 'PLACE MARKER',
                action: () => {
                    if (this.activeGameCoords) {
                        setCustomMarker(this.activeGameCoords.x, this.activeGameCoords.y, this.activeWorldspaceId);
                    }
                    this.close();
                }
            });
        }

        if (isClickingExisting || hasExistingMarker) {
            buttons.push({
                id: 'removeMarker',
                label: 'REMOVE MARKER',
                action: () => {
                    removeCustomMarker();
                    this.close();
                }
            });
        }

        buttons.push({
            id: 'cancel',
            label: 'CANCEL',
            action: () => {
                this.close();
            }
        });

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
