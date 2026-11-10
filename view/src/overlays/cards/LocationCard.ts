import { SettlementData } from '@/types/payloads.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';
import { Corner } from '@/overlays/positioning.js';
import { calculateSettlementRatings, SettlementDataWithRatings } from '@/overlays/domain/settlementRules.js';

import { domainState } from '@/core/state/index.js';
import { getWorldspaceName } from '@/core/state/worldspaces.js';
import { toggleFavoriteLocation, setCustomMarker } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';

import { AssetManager } from '@/systems/assetManager.js';
import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';

import { LocationsList } from '@/overlays/panels/LocationsPanel.js';
import { Card, type ActionButtonConfig } from '@/ui/index.js';

export interface LocationCardOpenOptions {
    markerFormId: number;
    title?: string;
    canFastTravel?: boolean;
    settlement?: SettlementData;
    dockCorner?: Corner;
    takeFocus?: boolean;
}

/**
 * Unified Location Detail Card controller.
 * Handles floating detail presentation for both standard POI markers and
 * player settlement workshops with dynamic resource simulation metrics.
 */
export class LocationCardController implements InputReceiver {
    public readonly id = FocusOwner.LOCATION_CARD;

    public activeMarkerFormId: number | null = null;
    public activeMarkerName: string = '';
    public activeSettlement: SettlementData | null = null;
    public canFastTravel: boolean = false;
    public activeDockCorner: Corner | null = null;

    public onClose: (() => void) | null = null;
    public onNavBack: (() => boolean) | null = null;
    public onFastTravel: ((formId: number, name: string) => void) | null = null;

    private card: Card | null = null;

    public isDocked(): boolean {
        return this.activeDockCorner !== null;
    }

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
                    this.updateButtonSelection();
                }
                return true;

            case KeyAction.NAV_DOWN:
                if (this.card) {
                    this.card.navigateNext();
                    this.updateButtonSelection();
                }
                return true;

            case KeyAction.SELECT:
                if (this.card) {
                    this.card.triggerSelected();
                }
                return true;

            case KeyAction.CENTER_ITEM:
                if (this.isDocked() && this.activeMarkerFormId !== null) {
                    SoundService.playShowOnMap();
                    const marker = domainState.markers.get(this.activeMarkerFormId);
                    if (marker) {
                        mapSurface.centerOnTarget(marker.worldspace, marker.x, marker.y, 0);
                    }
                    return true;
                }
                return false;

            case KeyAction.NAV_LEFT:
                if (this.activeDockCorner && !this.activeDockCorner.includes('right')) {
                    SoundService.playFocus();
                    InputRouter.pop();
                    return true;
                }
                return true;

            case KeyAction.NAV_RIGHT:
                if (this.activeDockCorner?.includes('right')) {
                    SoundService.playFocus();
                    InputRouter.pop();
                    return true;
                }
                return true;

            default:
                return false;
        }
    }

    public getAvailableControls(): ControlActionHint[] {
        const controls: ControlActionHint[] = [KeyAction.NAV_BACK];
        const buttons = this.buildButtonConfigs();
        if (buttons.length > 1) {
            controls.push(KeyAction.NAV_UP, KeyAction.NAV_DOWN);
        }
        controls.push(KeyAction.PAN_MOUSE);
        if (this.isDocked() && this.activeMarkerFormId !== null) {
            controls.push({ action: KeyAction.CENTER_ITEM, label: t('markers.controls.centerMarker') });
        }
        if (buttons.length > 0) {
            controls.push(KeyAction.SELECT);
        }
        return controls;
    }

    public onFocusGained(): void {
        this.card?.setFocused(true);
        if (this.card) {
            this.card.getButtonGroup().setSelectedIndex(0);
        }
        this.updateButtonSelection();
    }

    public onFocusLost(): void {
        this.card?.setFocused(false);
        this.updateButtonSelection();
    }

    public isOpen(): boolean {
        return !!this.card && this.card.isOpen();
    }

    public open(options: LocationCardOpenOptions): void {
        const title = options.title ?? options.settlement?.name ?? '';
        const markerFormId = options.markerFormId;
        const canFastTravel = options.canFastTravel ?? false;
        const dockCorner = options.dockCorner;
        const takeFocus = options.takeFocus ?? true;

        this.activeMarkerName = title;
        this.activeMarkerFormId = markerFormId;
        this.activeSettlement = options.settlement ?? null;
        this.canFastTravel = canFastTravel;
        this.activeDockCorner = dockCorner ?? null;

        const buttons = this.buildButtonConfigs();
        const bodyHtml = this.activeSettlement ? this.buildBodyHtml(this.activeSettlement) : '';

        if (!this.card) {
            this.card = new Card({
                id: 'location-card-panel',
                title: title,
                bodyHtml: bodyHtml,
                buttons: buttons,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
            this.card.mount();
        } else {
            this.card.update({
                title: title,
                bodyHtml: bodyHtml,
                buttons: buttons
            });
        }

        this.card.element.classList.toggle('has-settlement', Boolean(this.activeSettlement));
        this.card.show();

        if (takeFocus) {
            InputRouter.push(this);
        } else {
            this.updateButtonSelection();
        }
    }

    public close(): void {
        this.activeDockCorner = null;

        if (this.card) {
            this.card.hide();
        }

        if (this.onClose) {
            this.onClose();
        }
    }

    public updateButtonSelection(): void {
        if (!this.card) return;

        const card = this.card.element;
        if (!card) return;

        const isCardFocused = InputRouter.getFocus() === this.id;
        const selectedIdx = this.card.getButtonGroup().getSelectedIndex();
        const buttons = card.querySelectorAll('.fc-action-btn');

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === selectedIdx) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    public buildBodyHtml(settlement: SettlementDataWithRatings): string {
        const foodSvg = AssetManager.getIconSvg('workshop-metric-food');
        const waterSvg = AssetManager.getIconSvg('workshop-metric-water');
        const bedsSvg = AssetManager.getIconSvg('workshop-metric-beds');
        const powerSvg = AssetManager.getIconSvg('workshop-metric-power');
        const defenseSvg = AssetManager.getIconSvg('workshop-metric-defense');
        const populationSvg = AssetManager.getIconSvg('workshop-metric-population');
        const happinessSvg = AssetManager.getIconSvg('workshop-metric-happiness');

        const alertSvg = AssetManager.getIconSvg('workshop-alert');
        const increasingSvg = AssetManager.getIconSvg('workshop-increasing');

        const resolvedRatings = calculateSettlementRatings(settlement);

        const renderMetricItem = (iconSvg: string, val: number | string, rating: number) => {
            let statusIcon = '';
            if (rating < 0) {
                statusIcon = `<span class="wc-status-badge icon-wrapper">${alertSvg}</span>`;
            } else if (rating > 0) {
                statusIcon = `<span class="wc-status-badge icon-wrapper">${increasingSvg}</span>`;
            }

            return `
                <div class="wc-stat-item">
                    <span class="wc-stat-icon icon-wrapper">${iconSvg}</span>
                    <span class="wc-stat-value">${val}</span>
                    ${statusIcon}
                </div>
            `;
        };

        let locationSectionHtml = '';
        const wsFullName = getWorldspaceName(settlement.worldspace);
        if (wsFullName) {
            locationSectionHtml = `
            <div class="fc-section">
                <div class="fc-section-box">
                    <div class="fc-section-title">${t('settlements.card.location')}</div>
                    <div class="fc-section-text">${wsFullName}</div>
                </div>
            </div>`;
        }

        return `
            <div class="fc-section">
                <div class="fc-section-box wc-stats-box">
                    <div class="wc-stats-grid">
                        ${renderMetricItem(peopleSvg || populationSvg, settlement.population, resolvedRatings.population)}
                        ${renderMetricItem(foodSvg, settlement.food, resolvedRatings.food)}
                        ${renderMetricItem(waterSvg, settlement.water, resolvedRatings.water)}
                        ${renderMetricItem(powerSvg, settlement.power, resolvedRatings.power)}
                        ${renderMetricItem(defenseSvg, settlement.defense, resolvedRatings.defense)}
                        ${renderMetricItem(bedsSvg, settlement.beds, resolvedRatings.beds)}
                        ${renderMetricItem(happinessSvg, `${settlement.happiness}%`, resolvedRatings.happiness)}
                    </div>
                </div>
            </div>
            ${locationSectionHtml}
        `;
    }

    public buildButtonConfigs(): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];

        if (this.canFastTravel) {
            buttons.push({
                id: 'fastTravel',
                label: t('markers.controls.fastTravel'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        this.onFastTravel?.(this.activeMarkerFormId, this.activeMarkerName);
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
            const isFav = domainState.favoriteLocations.has(this.activeMarkerFormId);
            buttons.push({
                id: 'favorite',
                label: isFav ? t('locations.controls.unfavorite') : t('locations.controls.favorite'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        toggleFavoriteLocation(this.activeMarkerFormId);
                        domainState.toggleFavoriteLocation(this.activeMarkerFormId);

                        this.open({
                            markerFormId: this.activeMarkerFormId,
                            title: this.activeMarkerName,
                            canFastTravel: this.canFastTravel,
                            settlement: this.activeSettlement || undefined,
                            dockCorner: this.activeDockCorner || undefined,
                            takeFocus: false
                        });

                        LocationsList.render();
                    }
                }
            });
        }

        const hasExistingMarker = Boolean(domainState.lastPayload?.custom_marker);
        buttons.push({
            id: 'placeMarker',
            label: hasExistingMarker ? t('markers.customMarker.moveMarker') : t('markers.customMarker.placeMarker'),
            action: () => {
                if (this.activeMarkerFormId !== null) {
                    const marker = domainState.markers.get(this.activeMarkerFormId);
                    if (marker) {
                        setCustomMarker(marker.x, marker.y, marker.worldspace);
                    }
                }
            }
        });

        return buttons;
    }
}

const peopleSvg = AssetManager.getIconSvg('workshop-metric-people') || AssetManager.getIconSvg('workshop-metric-population');

export const locationCard = new LocationCardController();
export const LocationCard = locationCard;

window.addEventListener('languageChanged', () => {
    if (locationCard.isOpen() && locationCard.activeMarkerFormId !== null) {
        locationCard.open({
            markerFormId: locationCard.activeMarkerFormId,
            title: locationCard.activeMarkerName,
            canFastTravel: locationCard.canFastTravel,
            settlement: locationCard.activeSettlement || undefined,
            dockCorner: locationCard.activeDockCorner || undefined,
            takeFocus: false
        });
    }
});
