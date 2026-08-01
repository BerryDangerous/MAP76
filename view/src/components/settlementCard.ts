import { SettlementData } from '../types/payloads.js';
import { FocusManager } from '../systems/focusManager.js';
import { MapViewport } from './viewport.js';
import { FloatingCard } from '../ui/floatingCard.js';
import { ActionButtonConfig } from '../ui/actionButton.js';
import { ThemeEngine } from '../systems/theme.js';
import { KeybindsSystem } from '../systems/keybinds.js';
import { EngineBridge } from '../core/bridge.js';
import { showFastTravelConfirmationModal } from './fastTravelModal.js';


let settlementCardInstance: FloatingCard | null = null;

export interface SettlementDataWithRatings extends SettlementData {
    ratings?: {
        food?: number;
        water?: number;
        beds?: number;
        power?: number;
        defense?: number;
        population?: number;
        happiness?: number;
        overallAlert?: boolean;
    };
}

export const SettlementCard = {
    activeSettlement: null as SettlementDataWithRatings | null,
    activeAnchorMarker: null as HTMLElement | null,
    activeMarkerFormId: null as number | null,
    canFastTravel: false,

    init(): void {
        FocusManager.register({
            id: 'SETTLEMENT_CARD',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.add('focused');
                if (settlementCardInstance) {
                    settlementCardInstance.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: () => {
                const card = document.getElementById('settlement-card-panel');
                if (card) card.classList.remove('focused');
                this.updateButtonSelection();
                if (settlementCardInstance && settlementCardInstance.isOpen()) {
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

        if (settlementCardInstance) {
            const buttonGroup = settlementCardInstance.getButtonGroup();
            if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
                buttonGroup.navigateNext();
                this.updateButtonSelection();
                return true;
            }

            if (KeybindsSystem.isAction(e, 'NAV_UP')) {
                buttonGroup.navigatePrev();
                this.updateButtonSelection();
                return true;
            }

            if (KeybindsSystem.isAction(e, 'SELECT')) {
                buttonGroup.triggerSelected();
                return true;
            }
        }
        return false;
    },

    open(settlement: SettlementDataWithRatings, markerFormId: number, canFastTravel: boolean, anchorMarker?: HTMLElement): void {
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
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            settlementCardInstance.update({
                title: settlement.name,
                bodyHtml: bodyHtml,
                buttons: buttons,
                anchorMarker: this.activeAnchorMarker
            });
        }

        settlementCardInstance.open(this.activeAnchorMarker);
        FocusManager.setFocus('SETTLEMENT_CARD');
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

        const ratings = settlement.ratings || {};

        const foodRating = ratings.food ?? (settlement.food < settlement.population ? -1 : 0);
        const waterRating = ratings.water ?? (settlement.water < settlement.population ? -1 : 0);
        const bedsRating = ratings.beds ?? (settlement.beds < settlement.population ? -1 : 0);
        const defenseRating = ratings.defense ?? (settlement.defense < (settlement.food + settlement.water) ? -1 : 0);
        const happinessRating = ratings.happiness ?? 0;

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

        return `
            <div class="fc-section">
                <div class="fc-section-box wc-stats-box">
                    <div class="wc-stats-grid">
                        ${renderMetricItem(populationUrl, settlement.population, ratings.population ?? 0)}
                        ${renderMetricItem(happinessUrl, `${settlement.happiness}%`, happinessRating)}
                        ${renderMetricItem(foodUrl, settlement.food, foodRating)}
                        ${renderMetricItem(waterUrl, settlement.water, waterRating)}
                        ${renderMetricItem(powerUrl, settlement.power, ratings.power ?? 0)}
                        ${renderMetricItem(defenseUrl, settlement.defense, defenseRating)}
                        ${renderMetricItem(bedsUrl, settlement.beds, bedsRating)}
                    </div>
                </div>
            </div>
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
                            showFastTravelConfirmationModal(settlement.name, () => {
                                EngineBridge.requestFastTravel(this.activeMarkerFormId!);
                                FocusManager.setFocus('MAP');
                                this.close();
                            });
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
    markerEl?: HTMLElement
): void {
    SettlementCard.open(settlement, markerFormId, canFastTravel, markerEl);
}
