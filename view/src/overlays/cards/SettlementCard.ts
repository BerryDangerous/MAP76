import { ScreenAnchor } from '@/types/seams.js';
import { SettlementData } from '@/types/payloads.js';
import { domainState } from '@/core/state/index.js';
import { getWorldspaceName, isSameWorldspace } from '@/core/state/worldspaces.js';
import { toggleFavoriteLocation, setCustomMarker } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';
import { AssetManager } from '@/systems/assetManager.js';
import { Corner } from '@/overlays/positioning.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';
import { LocationsList } from '@/overlays/panels/LocationsPanel.js';
import { calculateSettlementRatings, SettlementDataWithRatings } from '@/overlays/domain/settlementRules.js';
import { FloatingCard, type ActionButtonConfig } from '@/ui/index.js';

export class SettlementCardController implements InputReceiver {
    public readonly id = FocusOwner.SETTLEMENT_CARD;

    public activeSettlement: SettlementDataWithRatings | null = null;
    public activeAnchorMarker: HTMLElement | null = null;
    public activeMarkerFormId: number | null = null;
    public canFastTravel: boolean = false;
    public activeDockCorner: Corner | null = null;

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
                    this.updateButtonSelection();
                }
                return true;

            case KeyAction.NAV_DOWN:
                if (this.instance) {
                    this.instance.getButtonGroup().navigateNext();
                    this.updateButtonSelection();
                }
                return true;

            case KeyAction.SELECT:
                if (this.instance) {
                    this.instance.getButtonGroup().triggerSelected();
                }
                return true;

            case KeyAction.CENTER_ITEM:
                if (this.activeAnchorMarker === null && this.activeSettlement) {
                    if (this.activeSettlement.worldspace !== undefined && isSameWorldspace(this.activeSettlement.worldspace, domainState.getActiveWorldspaceID())) {
                        SoundService.playShowOnMap();
                        const marker = this.activeMarkerFormId !== null ? domainState.markers.get(this.activeMarkerFormId) : undefined;
                        if (marker) {
                            mapSurface.centerOnTarget(marker.worldspace, marker.x, marker.y, 0);
                        }
                        return true;
                    }
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
        const buttons = this.activeSettlement ? this.buildButtonConfigs(this.activeSettlement) : [];
        if (buttons.length > 1) {
            controls.push(KeyAction.NAV_UP, KeyAction.NAV_DOWN);
        }
        controls.push(KeyAction.PAN_MOUSE);
        if (this.activeAnchorMarker === null && this.activeSettlement) {
            if (this.activeSettlement.worldspace !== undefined && isSameWorldspace(this.activeSettlement.worldspace, domainState.getActiveWorldspaceID())) {
                controls.push({ action: KeyAction.CENTER_ITEM, label: t('markers.controls.centerMarker') });
            }
        }
        if (buttons.length > 0) {
            controls.push(KeyAction.SELECT);
        }
        return controls;
    }

    public onFocusGained(): void {
        const card = document.getElementById('settlement-card-panel');
        if (card) card.classList.add('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(true);
            this.instance.getButtonGroup().setSelectedIndex(0);
        }
        this.updateButtonSelection();
    }

    public onFocusLost(): void {
        const card = document.getElementById('settlement-card-panel');
        if (card) card.classList.remove('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(false);
        }
        this.updateButtonSelection();
    }

    public open(
        settlement: SettlementDataWithRatings,
        markerFormId: number,
        canFastTravel: boolean,
        anchorMarker?: HTMLElement,
        referencePanel?: HTMLElement,
        dockCorner?: Corner,
        takeFocus: boolean = true,
        returnFocusId?: string,
        onNavBack?: () => void,
        screenAnchor?: ScreenAnchor
    ): void {
        if (this.activeAnchorMarker && this.activeAnchorMarker !== anchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
        }

        this.activeSettlement = settlement;
        this.activeAnchorMarker = anchorMarker || null;
        this.activeMarkerFormId = markerFormId;
        this.canFastTravel = canFastTravel;
        this.activeDockCorner = referencePanel ? (dockCorner ?? null) : null;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        const bodyHtml = this.buildBodyHtml(settlement);
        const buttons = this.buildButtonConfigs(settlement);

        if (!this.instance) {
            this.instance = new FloatingCard({
                id: 'settlement-card-panel',
                title: settlement.name,
                bodyHtml: bodyHtml,
                buttons: buttons,
                screenAnchor: screenAnchor,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            this.instance.update({
                title: settlement.name,
                bodyHtml: bodyHtml,
                buttons: buttons,
                screenAnchor: screenAnchor,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack
            });
        }

        this.instance.open(this.activeAnchorMarker || undefined, referencePanel, dockCorner);
        OverlayManager.openCard('SETTLEMENT_CARD', {
            cardElement: this.instance.getElement(),
            referencePanel: referencePanel || null,
            onDismiss: () => this.close(),
            takeFocus: takeFocus,
            returnFocusId: returnFocusId
        });

        if (takeFocus) {
            InputRouter.push(this);
        }

        this.updateButtonSelection();
    }

    public close(): void {
        this.activeDockCorner = null;
        if (this.activeAnchorMarker) {
            let el = this.activeAnchorMarker;
            if (!el.isConnected && this.activeMarkerFormId !== null) {
                const reconnected = document.querySelector(`.marker-container[data-form-id="${this.activeMarkerFormId}"]`) as HTMLElement | null;
                if (reconnected) el = reconnected;
            }
            el.classList.remove('menu-active');
            el.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            mapSurface.updateViewportTransform();
        }

        if (this.instance) {
            this.instance.close();
        }

        OverlayManager.notifyCardClosed('SETTLEMENT_CARD');
    }

    public positionNearMarker(): void {
        if (this.instance) {
            this.instance.updatePosition();
        }
    }

    public isOpen(): boolean {
        return !!this.instance && this.instance.isOpen();
    }

    public updateButtonSelection(): void {
        if (!this.instance) return;

        const card = this.instance.getElement();
        if (!card) return;

        const isCardFocused = InputRouter.getFocus() === FocusOwner.SETTLEMENT_CARD;
        const buttons = card.querySelectorAll('.fc-action-btn');
        const selectedIdx = this.instance.getButtonGroup().getSelectedIndex();

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
                    <div class="fc-section-title">${t('settlements.card.stats')}</div>
                    <div class="wc-stats-grid">
                        ${renderMetricItem(populationSvg, settlement.population, resolvedRatings.population)}
                        ${renderMetricItem(happinessSvg, `${settlement.happiness}%`, resolvedRatings.happiness)}
                        ${renderMetricItem(foodSvg, settlement.food, resolvedRatings.food)}
                        ${renderMetricItem(waterSvg, settlement.water, resolvedRatings.water)}
                        ${renderMetricItem(powerSvg, settlement.power, resolvedRatings.power)}
                        ${renderMetricItem(defenseSvg, settlement.defense, resolvedRatings.defense)}
                        ${renderMetricItem(bedsSvg, settlement.beds, resolvedRatings.beds)}
                    </div>
                </div>
            </div>
            ${locationSectionHtml}
        `;
    }

    public buildButtonConfigs(settlement: SettlementDataWithRatings): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];

        if (this.canFastTravel) {
            buttons.push({
                id: 'fastTravel',
                label: t('markers.controls.fastTravel'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        mapSurface.requestFastTravel(this.activeMarkerFormId, settlement.name);
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

                        if (this.activeSettlement) {
                            this.open(
                                this.activeSettlement,
                                this.activeMarkerFormId,
                                this.canFastTravel,
                                this.activeAnchorMarker || undefined,
                                undefined,
                                undefined,
                                false
                            );

                            LocationsList.render();
                        }
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

export const settlementCard = new SettlementCardController();
export const SettlementCard = settlementCard;

export function renderSettlementCardContent(
    containerEl: HTMLElement,
    settlement: SettlementData,
    markerFormId: number,
    canFastTravel: boolean,
    markerEl?: HTMLElement,
    referencePanel?: HTMLElement,
    dockCorner?: Corner,
    takeFocus: boolean = true,
    returnFocusId?: string,
    onNavBack?: () => void
): void {
    settlementCard.open(settlement, markerFormId, canFastTravel, markerEl, referencePanel, dockCorner, takeFocus, returnFocusId, onNavBack);
}

window.addEventListener('languageChanged', () => {
    if (settlementCard.isOpen() && settlementCard.activeSettlement && settlementCard.activeMarkerFormId !== null) {
        settlementCard.open(
            settlementCard.activeSettlement,
            settlementCard.activeMarkerFormId,
            settlementCard.canFastTravel,
            settlementCard.activeAnchorMarker || undefined,
            undefined,
            undefined,
            false
        );
    }
});
