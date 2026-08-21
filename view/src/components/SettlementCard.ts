import { SettlementData } from '@/types/payloads.js';

import { mapState } from '@/core/state.js';

import { ThemeEngine } from '@/systems/assetManager.js';
import { DockCorner } from '@/systems/dockControls.js';
import { FocusManager } from '@/systems/focusManager.js';
import { MarkerInteractionManager } from '@/systems/markerController.js';
import { MapViewport } from '@/systems/viewport.js';

import { calculateSettlementRatings, SettlementDataWithRatings } from '@/utils/settlementUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

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
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', 'PAN_MOUSE'];
                if (SettlementCard.activeAnchorMarker === null && SettlementCard.activeSettlement) {
                    if (SettlementCard.activeSettlement.worldspace !== undefined && WorldspaceUtils.isSameWorldspace(SettlementCard.activeSettlement.worldspace, mapState.activeMapConfig.worldspaceID)) {
                        controls.push({ action: 'CENTER_ITEM', label: 'CENTER MARKER' });
                    }
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.add('focused');
                if (settlementCardInstance) {
                    settlementCardInstance.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.remove('focused');
                this.updateButtonSelection();
                if (newFocusId === 'MAP' || newFocusId === 'QUEST_CARD' || newFocusId === 'QUEST_LIST' || newFocusId === 'MARKER_CARD') {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        return settlementCardInstance ? settlementCardInstance.handleKeyDown(e) : false;
    },

    open(settlement: SettlementDataWithRatings, markerFormId: number, canFastTravel: boolean, anchorMarker?: HTMLElement, referencePanel?: HTMLElement, dockCorner?: DockCorner, takeFocus: boolean = true, returnFocusId?: string, onNavBack?: () => void): void {
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
        const foodUrl = ThemeEngine.getAssetIconUrl('workshop-metric-food');
        const waterUrl = ThemeEngine.getAssetIconUrl('workshop-metric-water');
        const bedsUrl = ThemeEngine.getAssetIconUrl('workshop-metric-beds');
        const powerUrl = ThemeEngine.getAssetIconUrl('workshop-metric-power');
        const defenseUrl = ThemeEngine.getAssetIconUrl('workshop-metric-defense');
        const populationUrl = ThemeEngine.getAssetIconUrl('workshop-metric-population');
        const happinessUrl = ThemeEngine.getAssetIconUrl('workshop-metric-happiness');

        const alertUrl = ThemeEngine.getAssetIconUrl('workshop-alert');
        const increasingUrl = ThemeEngine.getAssetIconUrl('workshop-increasing');

        const resolvedRatings = calculateSettlementRatings(settlement);

        const renderMetricItem = (iconUrl: string, val: number | string, rating: number) => {
            let statusIcon = '';
            if (rating < 0) {
                statusIcon = `<img class="wc-status-badge" src="${alertUrl}" alt="Alert" />`;
            } else if (rating > 0) {
                statusIcon = `<img class="wc-status-badge" src="${increasingUrl}" alt="Increasing" />`;
            }

            return `
                <div class="wc-stat-item">
                    <img class="wc-stat-icon" src="${iconUrl}" />
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
                    <div class="fc-section-title">LOCATION</div>
                    <div class="fc-section-text">${wsFullName}</div>
                </div>
            </div>`;
        }

        return `
            <div class="fc-section">
                <div class="fc-section-box wc-stats-box">
                    <div class="fc-section-title">STATS</div>
                    <div class="wc-stats-grid">
                        ${renderMetricItem(populationUrl, settlement.population, resolvedRatings.population)}
                        ${renderMetricItem(happinessUrl, `${settlement.happiness}%`, resolvedRatings.happiness)}
                        ${renderMetricItem(foodUrl, settlement.food, resolvedRatings.food)}
                        ${renderMetricItem(waterUrl, settlement.water, resolvedRatings.water)}
                        ${renderMetricItem(powerUrl, settlement.power, resolvedRatings.power)}
                        ${renderMetricItem(defenseUrl, settlement.defense, resolvedRatings.defense)}
                        ${renderMetricItem(bedsUrl, settlement.beds, resolvedRatings.beds)}
                    </div>
                </div>
            </div>
            ${locationSectionHtml}
        `;
    },

    buildButtonConfigs(settlement: SettlementDataWithRatings): ActionButtonConfig[] {
        if (this.canFastTravel) {
            return [
                {
                    id: 'fastTravel',
                    label: 'FAST TRAVEL',
                    action: () => {
                        if (this.activeMarkerFormId !== null) {
                            MarkerInteractionManager.initiateFastTravel(this.activeMarkerFormId, settlement.name);
                        }
                    }
                }
            ];
        } else {
            return [
                {
                    id: 'undiscovered',
                    label: 'UNDISCOVERED',
                    action: () => {}
                }
            ];
        }
    }
};

export function renderSettlementCardContent(
    containerEl: HTMLElement,
    settlement: SettlementData,
    markerFormId: number,
    canFastTravel: boolean,
    markerEl?: HTMLElement,
    referencePanel?: HTMLElement,
    dockCorner?: DockCorner,
    takeFocus: boolean = true,
    returnFocusId?: string,
    onNavBack?: () => void
): void {
    SettlementCard.open(settlement, markerFormId, canFastTravel, markerEl, referencePanel, dockCorner, takeFocus, returnFocusId, onNavBack);
}
