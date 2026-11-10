import { Point2D } from '@/types/seams.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';

import { domainState } from '@/core/state/index.js';
import { setCustomMarker, removeCustomMarker } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';

import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';

import { Card, type ActionButtonConfig } from '@/ui/index.js';

export interface CustomMarkerCardOpenOptions {
    isExistingMarkerClick?: boolean;
    gameCoords?: Point2D | null;
    worldspaceId?: number;
}

export class CustomMarkerCardController implements InputReceiver {
    public readonly id = FocusOwner.CUSTOM_MARKER_CARD;

    public isExistingMarkerClick: boolean = false;
    public activeGameCoords: Point2D | null = null;
    public activeWorldspaceId: number | undefined = undefined;

    public onClose: (() => void) | null = null;
    public onNavBack: (() => boolean) | null = null;

    private card: Card | null = null;

    public getElement(): HTMLElement | null {
        return this.card?.element ?? null;
    }

    public setAnchored(anchored: boolean): void {
        this.card?.setAnchored(anchored);
    }

    public init(): void {
        InputRouter.register(this);
    }

    public handleAction(action: KeyAction): boolean {
        switch (action) {
            case KeyAction.NAV_BACK:
                SoundService.playFocus();
                if (this.onNavBack?.()) {
                    return true;
                }
                this.close();
                return true;

            case KeyAction.NAV_UP:
                if (this.card) {
                    this.card.navigatePrev();
                }
                return true;

            case KeyAction.NAV_DOWN:
                if (this.card) {
                    this.card.navigateNext();
                }
                return true;

            case KeyAction.SELECT:
                if (this.card) {
                    this.card.triggerSelected();
                }
                return true;

            case KeyAction.CENTER_ITEM:
                if (this.activeGameCoords) {
                    SoundService.playShowOnMap();
                    mapSurface.centerOnWorldCoords(this.activeGameCoords.x, this.activeGameCoords.y);
                    return true;
                }
                return false;

            default:
                return false;
        }
    }

    public getAvailableControls(): ControlActionHint[] {
        const controls: ControlActionHint[] = [KeyAction.NAV_BACK, KeyAction.NAV_UP, KeyAction.NAV_DOWN, KeyAction.PAN_MOUSE];
        if (this.activeGameCoords) {
            controls.push({ action: KeyAction.CENTER_ITEM, label: t('markers.controls.centerMarker') });
        }
        controls.push(KeyAction.SELECT);
        return controls;
    }

    public onFocusGained(): void {
        this.card?.setFocused(true);
        if (this.card) {
            this.card.getButtonGroup().setSelectedIndex(0);
        }
    }

    public onFocusLost(): void {
        this.card?.setFocused(false);
    }

    public open(options: CustomMarkerCardOpenOptions): void {
        this.isExistingMarkerClick = Boolean(options.isExistingMarkerClick);
        this.activeGameCoords = options.gameCoords || null;
        this.activeWorldspaceId = options.worldspaceId;

        const isClickingExisting = this.isExistingMarkerClick;
        const hasExistingMarker = Boolean(domainState.lastPayload?.custom_marker);

        let title = t('markers.customMarker.placePrompt');
        if (isClickingExisting) {
            title = t('markers.customMarker.removePrompt');
        } else if (hasExistingMarker) {
            title = t('markers.customMarker.movePrompt');
        }

        const buttons = this.buildButtons(isClickingExisting, hasExistingMarker);

        if (!this.card) {
            this.card = new Card({
                id: 'custom-marker-card-panel',
                title: title,
                buttons: buttons
            });
            this.card.mount();
        } else {
            this.card.update({
                title: title,
                buttons: buttons
            });
        }

        this.card.show();
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
        this.isExistingMarkerClick = false;
        this.activeGameCoords = null;
        this.activeWorldspaceId = undefined;

        if (this.card) {
            this.card.hide();
        }

        if (this.onClose) {
            this.onClose();
        }
    }

    public isOpen(): boolean {
        return !!this.card && this.card.isOpen();
    }
}

export const customMarkerCard = new CustomMarkerCardController();
export const CustomMarkerCard = customMarkerCard;

window.addEventListener('languageChanged', () => {
    if (customMarkerCard.isOpen()) {
        customMarkerCard.open({
            isExistingMarkerClick: customMarkerCard.isExistingMarkerClick,
            gameCoords: customMarkerCard.activeGameCoords,
            worldspaceId: customMarkerCard.activeWorldspaceId
        });
    }
});
