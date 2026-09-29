import { QuestItem } from '@/types/quests.js';

import { toggleQuestActive, makeOnlyQuestActive, EngineBridge } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { Corner } from '@/systems/layoutManager.js';
import { MapViewport } from '@/systems/viewport.js';
import { OverlayManager } from '@/managers/overlayManager.js';

import { QuestUtils } from '@/utils/questUtils.js';
import { StringUtils } from '@/utils/stringUtils.js';

import { QuestList } from '@/components/QuestsPanel.js';

import { ActionButtonConfig } from '@/components/ui/ButtonGroup.js';
import { FloatingCard } from '@/components/ui/FloatingCard.js';
import { StatusItemList } from '@/components/ui/StatusItemList.js';

let floatingCard: FloatingCard | null = null;

export const QuestCard = {
    activeQuest: null as QuestItem | null,
    activeAnchorMarker: null as HTMLElement | null,

    init(): void {
        FocusManager.register({
            id: 'QUEST_CARD',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK'];
                const buttons = QuestCard.activeQuest ? QuestCard.buildButtonConfigs(QuestCard.activeQuest) : [];
                if (buttons.length > 1) {
                    controls.push('NAV_UP', 'NAV_DOWN');
                }
                controls.push('PAN_MOUSE');
                if (QuestCard.activeAnchorMarker === null && QuestCard.activeQuest && !QuestUtils.isQuestCompleted(QuestCard.activeQuest)) {
                    if (QuestUtils.hasActiveTargets(QuestCard.activeQuest)) {
                        controls.push({ action: 'CENTER_ITEM', label: t('quests.controls.centerObjective') });
                    }
                }
                if (buttons.length > 0) {
                    controls.push('SELECT');
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.add('focused');
                if (floatingCard) {
                    floatingCard.setReferencePanelDimmed(true);
                    floatingCard.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.remove('focused');
                if (floatingCard) {
                    floatingCard.setReferencePanelDimmed(false);
                }
                this.updateButtonSelection();
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            if (this.activeAnchorMarker === null && this.activeQuest && !QuestUtils.isQuestCompleted(this.activeQuest)) {
                if (QuestUtils.hasActiveTargets(this.activeQuest)) {
                    EngineBridge.emitSound('UIPipBoyMapZoom');
                    const firstTarget = this.activeQuest.objectives?.find(o => o.targets && o.targets.length > 0)?.targets[0];
                    if (firstTarget) {
                        MapViewport.centerOnTarget(firstTarget.worldspace, firstTarget.x, firstTarget.y, firstTarget.z);
                    }
                    return true;
                }
            }
        }
        return floatingCard ? floatingCard.handleKeyDown(e) : false;
    },

    open(quest: QuestItem, anchorMarker?: HTMLElement, referencePanel?: HTMLElement, dockCorner?: Corner, takeFocus: boolean = true, returnFocusId?: string, onNavBack?: () => void): void {
        if (this.activeAnchorMarker && this.activeAnchorMarker !== anchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
        }

        this.activeQuest = quest;
        this.activeAnchorMarker = anchorMarker || null;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        const questListContainer = referencePanel || document.getElementById('quest-list-panel');
        const dockCornerToUse = dockCorner || QuestList.getState().dockCorner;

        if (!floatingCard) {
            floatingCard = new FloatingCard({
                id: 'quest-card-panel',
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCornerToUse,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            floatingCard.update({
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCornerToUse,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack
            });
        }

        floatingCard.open(this.activeAnchorMarker, questListContainer, dockCornerToUse);

        OverlayManager.openCard('QUEST_CARD', {
            cardElement: floatingCard.getElement(),
            referencePanel: questListContainer,
            onDismiss: () => this.close(),
            takeFocus: takeFocus,
            returnFocusId: returnFocusId
        });

        const cardEl = floatingCard.getElement();
        if (cardEl) {
            const objListEl = cardEl.querySelector('.status-item-list') as HTMLElement;
            if (objListEl) {
                objListEl.scrollTop = objListEl.scrollHeight;
            }
        }

        this.updateButtonSelection();
    },

    positionNearMarker(marker: HTMLElement): void {
        if (floatingCard) {
            floatingCard.updatePosition();
        }
    },

    isOpen(): boolean {
        return !!floatingCard && floatingCard.isOpen();
    },

    close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            MapViewport.updateViewportTransform();
        }

        if (floatingCard) {
            floatingCard.close();
        }

        OverlayManager.notifyCardClosed('QUEST_CARD');
    },

    updateButtonSelection(): void {
        if (!floatingCard) return;

        const card = floatingCard.getElement();
        if (!card) return;

        const isCardFocused = FocusManager.getFocus() === 'QUEST_CARD';
        const buttons = card.querySelectorAll('.fc-action-btn');
        const selectedIdx = floatingCard.getButtonGroup().getSelectedIndex();

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === selectedIdx) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    },

    buildBodyHtml(quest: QuestItem): string {
        const hasJournal = Boolean(quest.journal && quest.journal.trim().length > 0);
        const journalText = hasJournal ? quest.journal.trim() : '';

        const objectivesHtml = StatusItemList.renderObjectives(quest.objectives || []);
        const hasObjectives = objectivesHtml.length > 0;

        const journalSectionHtml = hasJournal ? `
            <div class="fc-section">
                <div class="fc-section-box">
                    <div class="fc-section-title">${t('quests.card.journal')}</div>
                    <div class="fc-section-text">${StringUtils.escapeHtml(journalText)}</div>
                </div>
            </div>
        ` : '';

        const objectivesSectionHtml = hasObjectives ? `
            <div class="fc-section">
                <div class="fc-section-box">
                    <div class="fc-section-title">${t('quests.card.objectives')}</div>
                    <div class="status-item-list">
                        ${objectivesHtml}
                    </div>
                </div>
            </div>
        ` : '';

        return (hasJournal || hasObjectives) ? `
            ${journalSectionHtml}
            ${objectivesSectionHtml}
        ` : '';
    },

    buildButtonConfigs(quest: QuestItem): ActionButtonConfig[] {
        const isCompleted = QuestUtils.isQuestCompleted(quest);

        return isCompleted ? [
        ] : [
            {
                id: 'toggleActive',
                label: t('quests.controls.toggleActive'),
                action: () => {
                    if (quest.formId !== undefined) {
                        quest.isTracked = !quest.isTracked;
                        toggleQuestActive(quest.formId);
                        this.open(quest, this.activeAnchorMarker || undefined);
                    }
                }
            },
            {
                id: 'makeOnlyActive',
                label: t('quests.controls.makeOnlyActive'),
                action: () => {
                    if (quest.formId !== undefined) {
                        quest.isTracked = true;
                        makeOnlyQuestActive(quest.formId);
                        this.open(quest, this.activeAnchorMarker || undefined);
                    }
                }
            }
        ];
    }
};

window.addEventListener('languageChanged', () => {
    if (QuestCard.isOpen() && QuestCard.activeQuest) {
        QuestCard.open(QuestCard.activeQuest, QuestCard.activeAnchorMarker || undefined, undefined, undefined, false);
    }
});
