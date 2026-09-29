import { SettlementData } from '@/types/payloads.js';

import { mapState } from '@/core/state.js';
import { EngineBridge, toggleFavoriteLocation, setCustomMarker } from '@/core/bridge.js';

import { AssetManager } from '@/systems/assetManager.js';
import { FocusManager } from '@/systems/focusManager.js';
import { LocationsList } from './WorkshopsPanel.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { Corner } from '@/systems/layoutManager.js';
import { MarkerInteractionManager } from '@/systems/markerController.js';
import { MapViewport } from '@/systems/viewport.js';

import { calculateSettlementRatings, SettlementDataWithRatings } from '@/utils/settlementUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';
import { t } from '@/core/i18n.js';

import { ActionButtonConfig } from '@/components/ui/ButtonGroup.js';
import { FloatingCard } from '@/components/ui/FloatingCard.js';

let settlementCardInstance: FloatingCard | null = null;

export const SettlementCard = {
    activeSettlement: null as SettlementDataWithRatings | null,
    activeAnchorMarker: null as HTMLElement | null,
    activeMarkerFormId: null as number | null,
    canFastTravel: false,

    init(): void {
        FocusManager.register({
            id: 'SETTLEMENT_CARD',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK'];
                const buttons = SettlementCard.activeSettlement ? SettlementCard.buildButtonConfigs(SettlementCard.activeSettlement) : [];
                if (buttons.length > 1) {
                    controls.push('NAV_UP', 'NAV_DOWN');
                }
                controls.push('PAN_MOUSE');
                if (SettlementCard.activeAnchorMarker === null && SettlementCard.activeSettlement) {
                    if (SettlementCard.activeSettlement.worldspace !== undefined && WorldspaceUtils.isSameWorldspace(SettlementCard.activeSettlement.worldspace, mapState.activeMapConfig.worldspaceID)) {
                        controls.push({ action: 'CENTER_ITEM', label: t('markers.controls.centerMarker') });
                    }
                }
                if (buttons.length > 0) {
                    controls.push('SELECT');
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.add('focused');
                if (settlementCardInstance) {
                    settlementCardInstance.setReferencePanelDimmed(true);
                    settlementCardInstance.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.remove('focused');
                if (settlementCardInstance) {
                    settlementCardInstance.setReferencePanelDimmed(false);
                }
                this.updateButtonSelection();
                if (newFocusId === 'MAP' || newFocusId === 'QUEST_CARD' || newFocusId === 'QUEST_LIST' || newFocusId === 'MARKER_CARD') {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            if (this.activeAnchorMarker === null && this.activeSettlement) {
                if (this.activeSettlement.worldspace !== undefined && WorldspaceUtils.isSameWorldspace(this.activeSettlement.worldspace, mapState.activeMapConfig.worldspaceID)) {
                    EngineBridge.emitSound('UIPipBoyMapZoom');
                    const marker = mapState.lastPayload?.markers?.find(m => m.formId === this.activeMarkerFormId);
                    if (marker) {
                        MapViewport.centerOnTarget(marker.worldspace, marker.x, marker.y, 0);
                    }
                    return true;
                }
            }
        }
        return settlementCardInstance ? settlementCardInstance.handleKeyDown(e) : false;
    },

    open(settlement: SettlementDataWithRatings, markerFormId: number, canFastTravel: boolean, anchorMarker?: HTMLElement, referencePanel?: HTMLElement, dockCorner?: Corner, takeFocus: boolean = true, returnFocusId?: string, onNavBack?: () => void): void {
        if (this.activeAnchorMarker && this.activeAnchorMarker !== anchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
        }

        this.activeSettlement = settlement;
        this.activeAnchorMarker = anchorMarker || null;
        this.activeMarkerFormId = markerFormId;
        this.canFastTravel = canFastTravel;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        const bodyHtml = this.buildBodyHtml(settlement);
        const buttons = this.buildButtonConfigs(settlement);

        if (!settlementCardInstance) {
            settlementCardInstance = new FloatingCard({
                id: 'settlement-card-panel',
                title: settlement.name,
                bodyHtml: bodyHtml,
                buttons: buttons,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            settlementCardInstance.update({
                title: settlement.name,
                bodyHtml: bodyHtml,
                buttons: buttons,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: referencePanel,
                dockCorner: dockCorner,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack
            });
        }

        settlementCardInstance.open(this.activeAnchorMarker || undefined, referencePanel, dockCorner);
        if (takeFocus) {
            FocusManager.setFocus('SETTLEMENT_CARD');
        }
        this.updateButtonSelection();
    },

    close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            MapViewport.updateViewportTransform();
        }

        if (settlementCardInstance) {
            settlementCardInstance.close();
        }

        if (FocusManager.getFocus() === 'SETTLEMENT_CARD') {
            FocusManager.setFocus('MAP');
        }
    },

    positionNearMarker(): void {
        if (settlementCardInstance) {
            settlementCardInstance.updatePosition();
        }
    },

    isOpen(): boolean {
        return !!settlementCardInstance && settlementCardInstance.isOpen();
    },

    updateButtonSelection(): void {
        if (!settlementCardInstance) return;

        const card = settlementCardInstance.getElement();
        if (!card) return;

        const isCardFocused = FocusManager.getFocus() === 'SETTLEMENT_CARD';
        const buttons = card.querySelectorAll('.fc-action-btn');
        const selectedIdx = settlementCardInstance.getButtonGroup().getSelectedIndex();

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === selectedIdx) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    },

    buildBodyHtml(settlement: SettlementDataWithRatings): string {
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
        const wsFullName = WorldspaceUtils.getWorldspaceName(settlement.worldspace);
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
    },

    buildButtonConfigs(settlement: SettlementDataWithRatings): ActionButtonConfig[] {
        const buttons: ActionButtonConfig[] = [];
        
        if (this.canFastTravel) {
            buttons.push({
                id: 'fastTravel',
                label: t('markers.controls.fastTravel'),
                action: () => {
                    if (this.activeMarkerFormId !== null) {
                        MarkerInteractionManager.initiateFastTravel(this.activeMarkerFormId, settlement.name);
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
                        
                        if (this.activeSettlement) {
                            SettlementCard.open(
                                this.activeSettlement,
                                this.activeMarkerFormId,
                                this.canFastTravel,
                                this.activeAnchorMarker || undefined,
                                undefined, undefined, false
                            );
                            
                            LocationsList.render();
                        }
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
    SettlementCard.open(settlement, markerFormId, canFastTravel, markerEl, referencePanel, dockCorner, takeFocus, returnFocusId, onNavBack);
}

window.addEventListener('languageChanged', () => {
    if (SettlementCard.isOpen() && SettlementCard.activeSettlement && SettlementCard.activeMarkerFormId !== null) {
        SettlementCard.open(
            SettlementCard.activeSettlement,
            SettlementCard.activeMarkerFormId,
            SettlementCard.canFastTravel,
            SettlementCard.activeAnchorMarker || undefined,
            undefined, undefined, false
        );
    }
});
