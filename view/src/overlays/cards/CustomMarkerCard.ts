import { domainState } from '@/core/state/index.js';
import { setCustomMarker, removeCustomMarker } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';
import { FloatingCard, type ActionButtonConfig } from '@/ui/index.js';

export class CustomMarkerCardController implements InputReceiver {
    public readonly id = FocusOwner.CUSTOM_MARKER_CARD;

    public activeCoords: { x: number; y: number } | null = null;
    public activeGameCoords: { x: number; y: number } | null = null;
    public activeAnchorMarker: HTMLElement | null = null;
    public activeWorldspaceId: number | undefined = undefined;

    private instance: FloatingCard | null = null;

    public init(): void {
        InputRouter.register(this);
    }

    public handleAction(action: KeyAction): boolean {
        switch (action) {
            case KeyAction.NAV_BACK:
                SoundService.playFocus();
                this.close();
                InputRouter.pop();
                return true;

            case KeyAction.NAV_UP:
                if (this.instance) {
                    this.instance.getButtonGroup().navigatePrev();
                }
                return true;

            case KeyAction.NAV_DOWN:
                if (this.instance) {
                    this.instance.getButtonGroup().navigateNext();
                }
                return true;

            case KeyAction.SELECT:
                if (this.instance) {
                    this.instance.getButtonGroup().triggerSelected();
                }
                return true;

            case KeyAction.CENTER_ITEM:
                if (this.activeAnchorMarker === null && (this.activeGameCoords || this.activeCoords)) {
                    SoundService.playShowOnMap();
                    if (this.activeGameCoords) {
                        mapSurface.centerOnWorldCoords(this.activeGameCoords.x, this.activeGameCoords.y);
                    }
                    return true;
                }
                return false;

            default:
                return false;
        }
    }

    public getAvailableControls(): ControlActionHint[] {
        const controls: ControlActionHint[] = [KeyAction.NAV_BACK, KeyAction.NAV_UP, KeyAction.NAV_DOWN, KeyAction.PAN_MOUSE];
        if (this.activeAnchorMarker === null && (this.activeGameCoords || this.activeCoords)) {
            controls.push({ action: KeyAction.CENTER_ITEM, label: t('markers.controls.centerMarker') });
        }
        controls.push(KeyAction.SELECT);
        return controls;
    }

    public onFocusGained(): void {
        const card = document.getElementById('custom-marker-card-panel');
        if (card) card.classList.add('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(true);
            this.instance.getButtonGroup().setSelectedIndex(0);
        }
    }

    public onFocusLost(): void {
        const card = document.getElementById('custom-marker-card-panel');
        if (card) card.classList.remove('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(false);
        }
    }

    public open(options: {
        anchorMarker?: HTMLElement | null;
        gameCoords?: { x: number; y: number } | null;
        pageCoords?: { x: number; y: number } | null;
        worldspaceId?: number;
        returnFocusId?: string;
        onNavBack?: () => void;
    }): void {
        this.activeAnchorMarker = options.anchorMarker || null;
        this.activeCoords = options.pageCoords || null;
        this.activeGameCoords = options.gameCoords || null;
        this.activeWorldspaceId = options.worldspaceId;

        const isClickingExisting = Boolean(this.activeAnchorMarker);
        const hasExistingMarker = Boolean(domainState.lastPayload?.custom_marker);

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

        if (!this.instance) {
            this.instance = new FloatingCard(cardConfig);
        } else {
            this.instance.update(cardConfig);
        }

        this.instance.open(this.activeAnchorMarker || undefined);
        OverlayManager.openCard('CUSTOM_MARKER_CARD', {
            cardElement: this.instance.getElement(),
            referencePanel: null,
            onDismiss: () => this.close(),
            takeFocus: true,
            returnFocusId: options.returnFocusId
        });

        InputRouter.push(this);
    }

    public buildButtons(isClickingExisting: boolean, hasExistingMarker: boolean): ActionButtonConfig[] {
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
    }

    public close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('is-hovered');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            mapSurface.updateViewportTransform();
        }

        this.activeCoords = null;
        this.activeGameCoords = null;

        if (this.instance) {
            this.instance.close();
        }

        OverlayManager.notifyCardClosed('CUSTOM_MARKER_CARD');
    }

    public isOpen(): boolean {
        return this.instance ? this.instance.isOpen() : false;
    }
}

export const customMarkerCard = new CustomMarkerCardController();
export const CustomMarkerCard = customMarkerCard;

window.addEventListener('languageChanged', () => {
    if (customMarkerCard.isOpen()) {
        customMarkerCard.open({
            anchorMarker: customMarkerCard.activeAnchorMarker,
            gameCoords: customMarkerCard.activeGameCoords,
            pageCoords: customMarkerCard.activeCoords,
            worldspaceId: customMarkerCard.activeWorldspaceId
        });
    }
});
