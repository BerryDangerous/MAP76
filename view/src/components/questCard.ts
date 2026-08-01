import { QuestItem } from '../types/quests.js';
import { FocusManager } from '../systems/focusManager.js';
import { MapViewport } from './viewport.js';
import { QuestList } from './questList.js';
import { toggleQuestActive, makeOnlyQuestActive } from '../core/bridge.js';
import { ActionButtonConfig } from '../ui/actionButton.js';
import { KeybindsSystem } from '../systems/keybinds.js';
import { StatusItemList } from '../ui/statusItemList.js';
import { FloatingCard } from '../ui/floatingCard.js';

let floatingCard: FloatingCard | null = null;

export const QuestCard = {
    activeQuest: null as QuestItem | null,
    activeAnchorMarker: null as HTMLElement | null,

    init(): void {
        FocusManager.register({
            id: 'QUEST_CARD',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.add('focused');
                if (floatingCard) {
                    floatingCard.getButtonGroup().setSelectedIndex(0);
                }
                this.updateButtonSelection();
            },
            onFocusLost: (newFocusId?: string) => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.remove('focused');
                this.updateButtonSelection();
                if (newFocusId === 'MAP' || newFocusId === 'SETTLEMENT_CARD' || newFocusId === 'MARKER_CARD') {
                    this.close();
                }
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'NAV_LEFT')) {
            if (!QuestList.getState().isCollapsed) {
                FocusManager.setFocus('QUEST_LIST');
            }
            return true;
        }

        if (floatingCard) {
            const buttonGroup = floatingCard.getButtonGroup();
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

        return true;
    },

    open(quest: QuestItem, anchorMarker?: HTMLElement): void {
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

        const questListContainer = document.getElementById('quest-list-panel');
        const dockCorner = QuestList.getState().dockCorner;

        if (!floatingCard) {
            floatingCard = new FloatingCard({
                id: 'quest-card-panel',
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCorner,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            floatingCard.update({
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCorner
            });
        }

        floatingCard.open(this.activeAnchorMarker, questListContainer, dockCorner);

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

        if (FocusManager.getFocus() === 'QUEST_CARD') {
            FocusManager.setFocus('MAP');
        }
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
                    <div class="fc-section-title">JOURNAL</div>
                    <div class="fc-section-text">${this.escapeHtml(journalText)}</div>
                </div>
            </div>
        ` : '';

        const objectivesSectionHtml = hasObjectives ? `
            <div class="fc-section">
                <div class="fc-section-box">
                    <div class="fc-section-title">OBJECTIVES</div>
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
        const isCompleted = quest.objectives && quest.objectives.length > 0 && quest.objectives.every(o => o.state === 2 || o.state === 3);

        return isCompleted ? [
        ] : [
            {
                id: 'toggleActive',
                label: 'TOGGLE ACTIVE',
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
                label: 'MAKE ONLY THIS ACTIVE',
                action: () => {
                    if (quest.formId !== undefined) {
                        quest.isTracked = true;
                        makeOnlyQuestActive(quest.formId);
                        this.open(quest, this.activeAnchorMarker || undefined);
                    }
                }
            }
        ];
    },

    escapeHtml(str: string): string {
        return str.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }
};
