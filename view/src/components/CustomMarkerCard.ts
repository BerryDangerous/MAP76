import { setCustomMarker, removeCustomMarker } from '@/core/bridge.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { MapViewport } from '@/systems/viewport.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';
import { t } from '@/core/i18n.js';

import { ActionButtonConfig } from '@/components/ui/ButtonGroup.js';
import { FloatingCard } from '@/components/ui/FloatingCard.js';

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
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', 'NAV_UP', 'NAV_DOWN', 'PAN_MOUSE'];
                if (CustomMarkerCard.activeAnchorMarker === null && (CustomMarkerCard.activeGameCoords || CustomMarkerCard.activeCoords)) {
                    controls.push({ action: 'CENTER_ITEM', label: t('markers.controls.centerMarker') });
                }
                controls.push('SELECT');
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('custom-marker-card-panel');
                if (card) card.classList.add('focused');
                if (customMarkerCardInstance) {
                    customMarkerCardInstance.setReferencePanelDimmed(true);
                    customMarkerCardInstance.getButtonGroup().setSelectedIndex(0);
                }
            },
            onFocusLost: () => {
                const card = document.getElementById('custom-marker-card-panel');
                if (card) card.classList.remove('focused');
                if (customMarkerCardInstance) {
                    customMarkerCardInstance.setReferencePanelDimmed(false);
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            if (this.activeAnchorMarker === null && (this.activeGameCoords || this.activeCoords)) {
                SoundService.playShowOnMap();
                if (this.activeGameCoords) {
                    MapViewport.centerOnWorldCoords(this.activeGameCoords.x, this.activeGameCoords.y);
                }
                return true;
            }
        }
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

        let title = t('markers.customMarker.placePrompt');
        if (isClickingExisting) {
            title = t('markers.customMarker.removePrompt');
        } else if (hasExistingMarker) {
            title = t('markers.customMarker.movePrompt');
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
        OverlayManager.openCard('CUSTOM_MARKER_CARD', {
            cardElement: customMarkerCardInstance.getElement(),
            referencePanel: null,
            onDismiss: () => this.close(),
            takeFocus: true,
            returnFocusId: options.returnFocusId
        });
    },

    buildButtons(isClickingExisting: boolean, hasExistingMarker: boolean): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];

        if (!isClickingExisting) {
            buttons.push({
                id: 'placeMarker',
                label: hasExistingMarker ? t('markers.customMarker.moveMarker') : t('markers.customMarker.placeMarker'),
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
                label: t('markers.customMarker.removeMarker'),
                action: () => {
                    removeCustomMarker();
                    this.close();
                }
            });
        }

        buttons.push({
            id: 'cancel',
            label: t('markers.customMarker.cancel'),
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

        OverlayManager.notifyCardClosed('CUSTOM_MARKER_CARD');
    },

    isOpen(): boolean {
        return customMarkerCardInstance ? customMarkerCardInstance.isOpen() : false;
    }
};

window.addEventListener('languageChanged', () => {
    if (CustomMarkerCard.isOpen()) {
        CustomMarkerCard.open({
            anchorMarker: CustomMarkerCard.activeAnchorMarker,
            gameCoords: CustomMarkerCard.activeGameCoords,
            pageCoords: CustomMarkerCard.activeCoords,
            worldspaceId: CustomMarkerCard.activeWorldspaceId
        });
    }
});
