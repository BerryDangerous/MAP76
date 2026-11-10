import { QuestItem } from '@/types/quests.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';
import { Corner } from '@/overlays/positioning.js';
import { QuestUtils } from '@/overlays/domain/questRules.js';

import { toggleQuestActive, makeOnlyQuestActive } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';

import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';

import {
    Card,
    StatusItemList,
    startVaultBoyAnimation,
    stopVaultBoyAnimation,
    type ActionButtonConfig
} from '@/ui/index.js';

import { StringUtils } from '@/utils/stringUtils.js';

export interface QuestCardOpenOptions {
    quest: QuestItem;
    dockCorner?: Corner;
    takeFocus?: boolean;
}

export class QuestCardController implements InputReceiver {
    public readonly id = FocusOwner.QUEST_CARD;

    public activeQuest: QuestItem | null = null;
    public activeDockCorner: Corner | null = null;

    public onClose: (() => void) | null = null;
    public onNavBack: (() => boolean) | null = null;

    private card: Card | null = null;
    private scrollRafId: number | null = null;

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

            case KeyAction.NAV_RIGHT:
                if (this.activeDockCorner?.includes('right')) {
                    SoundService.playFocus();
                    InputRouter.pop();
                    return true;
                }
                return true;

            case KeyAction.NAV_LEFT:
                if (this.activeDockCorner && !this.activeDockCorner.includes('right')) {
                    SoundService.playFocus();
                    InputRouter.pop();
                    return true;
                }
                return true;

            case KeyAction.CENTER_ITEM:
                if (this.isDocked() && this.activeQuest && !QuestUtils.isQuestCompleted(this.activeQuest)) {
                    if (QuestUtils.hasActiveTargets(this.activeQuest)) {
                        SoundService.playShowOnMap();
                        const firstTarget = this.activeQuest.objectives?.find(o => o.targets && o.targets.length > 0)?.targets[0];
                        if (firstTarget) {
                            mapSurface.centerOnTarget(firstTarget.worldspace, firstTarget.x, firstTarget.y, firstTarget.z);
                        }
                        return true;
                    }
                }
                return false;

            default:
                return false;
        }
    }

    public getAvailableControls(): ControlActionHint[] {
        const controls: ControlActionHint[] = [KeyAction.NAV_BACK];
        const buttons = this.activeQuest ? this.buildButtonConfigs(this.activeQuest) : [];
        if (buttons.length > 1) {
            controls.push(KeyAction.NAV_UP, KeyAction.NAV_DOWN);
        }
        controls.push(KeyAction.PAN_MOUSE);
        if (this.isDocked() && this.activeQuest && !QuestUtils.isQuestCompleted(this.activeQuest)) {
            if (QuestUtils.hasActiveTargets(this.activeQuest)) {
                controls.push({ action: KeyAction.CENTER_ITEM, label: t('quests.controls.centerObjective') });
            }
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

    public open(options: QuestCardOpenOptions): void {
        const quest = options.quest;
        const dockCorner = options.dockCorner;
        const takeFocus = options.takeFocus ??  true;

        this.activeQuest = quest;
        this.activeDockCorner = dockCorner ?? null;

        const title = quest.questName;
        const bodyHtml = this.buildBodyHtml(quest);
        const buttons = this.buildButtonConfigs(quest);

        if (!this.card) {
            this.card = new Card({
                id: 'quest-card-panel',
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

        this.card.show();

        const cardEl = this.card.element;
        if (cardEl) {
            const vbCanvas = cardEl.querySelector('#quest-card-vaultboy-canvas') as HTMLCanvasElement | null;
            if (vbCanvas && quest.vaultBoyKey) {
                startVaultBoyAnimation(vbCanvas, quest.vaultBoyKey);
            } else {
                stopVaultBoyAnimation();
            }

            if (this.scrollRafId !== null) {
                cancelAnimationFrame(this.scrollRafId);
            }
            this.scrollRafId = requestAnimationFrame(() => {
                this.scrollRafId = null;
                const objListEl = cardEl.querySelector('.status-item-list');
                if (objListEl) {
                    objListEl.scrollTop = objListEl.scrollHeight;
                }
            });
        }

        if (takeFocus) {
            InputRouter.push(this);
        }

        this.updateButtonSelection();
    }

    public close(): void {
        stopVaultBoyAnimation();
        this.activeDockCorner = null;

        if (this.scrollRafId !== null) {
            cancelAnimationFrame(this.scrollRafId);
            this.scrollRafId = null;
        }

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

        const isCardFocused = InputRouter.getFocus() === FocusOwner.QUEST_CARD;
        const buttons = card.querySelectorAll('.fc-action-btn');
        const selectedIdx = this.card.getButtonGroup().getSelectedIndex();

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === selectedIdx) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    public buildBodyHtml(quest: QuestItem): string {
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

        // 386x349 canvas matches Bethesda Pip-Boy quest animation bounding aspect ratio (7729x6980 twips)
        const hasVaultBoy = Boolean(quest.vaultBoyKey && quest.vaultBoyKey.trim().length > 0);
        const vaultBoyHtml = hasVaultBoy ? `
            <div class="fc-section fc-vaultboy-container">
                <canvas id="quest-card-vaultboy-canvas" class="fc-vaultboy-canvas" width="386" height="349"></canvas>
            </div>
        ` : '';

        return `
            ${vaultBoyHtml}
            ${journalSectionHtml}
            ${objectivesSectionHtml}
        `;
    }

    public buildButtonConfigs(quest: QuestItem): ActionButtonConfig[] {
        const isCompleted = QuestUtils.isQuestCompleted(quest);

        return isCompleted ? [] : [
            {
                id: 'toggleActive',
                label: t('quests.controls.toggleActive'),
                action: () => {
                    if (quest.formId !== undefined) {
                        quest.isTracked = !quest.isTracked;
                        toggleQuestActive(quest.formId);
                        this.open({
                            quest,
                            dockCorner: this.activeDockCorner || undefined,
                            takeFocus: true
                        });
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
                        this.open({
                            quest,
                            dockCorner: this.activeDockCorner || undefined,
                            takeFocus: true
                        });
                    }
                }
            }
        ];
    }
}

export const questCard = new QuestCardController();
export const QuestCard = questCard;

window.addEventListener('languageChanged', () => {
    if (questCard.isOpen() && questCard.activeQuest) {
        questCard.open({
            quest: questCard.activeQuest,
            dockCorner: questCard.activeDockCorner || undefined,
            takeFocus: false
        });
    }
});
