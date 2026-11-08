import { ScreenAnchor } from '@/types/seams.js';
import { QuestItem } from '@/types/quests.js';
import { toggleQuestActive, makeOnlyQuestActive } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, type ControlActionHint } from '@/input/index.js';
import { Corner } from '@/overlays/positioning.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';
import { mapSurface } from '@/map/index.js';
import { QuestList } from '@/overlays/panels/QuestsPanel.js';
import { QuestUtils } from '@/overlays/domain/questRules.js';
import { StringUtils } from '@/utils/stringUtils.js';
import {
    FloatingCard,
    StatusItemList,
    startVaultBoyAnimation,
    stopVaultBoyAnimation,
    type ActionButtonConfig
} from '@/ui/index.js';

export class QuestCardController implements InputReceiver {
    public readonly id = FocusOwner.QUEST_CARD;

    public activeQuest: QuestItem | null = null;
    public activeAnchorMarker: HTMLElement | null = null;
    public activeDockCorner: Corner | null = null;

    private instance: FloatingCard | null = null;
    private scrollRafId: number | null = null;

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
                if (this.activeAnchorMarker === null && this.activeQuest && !QuestUtils.isQuestCompleted(this.activeQuest)) {
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
        if (this.activeAnchorMarker === null && this.activeQuest && !QuestUtils.isQuestCompleted(this.activeQuest)) {
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
        const card = document.getElementById('quest-card-panel');
        if (card) card.classList.add('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(true);
            this.instance.getButtonGroup().setSelectedIndex(0);
        }
        this.updateButtonSelection();
    }

    public onFocusLost(): void {
        const card = document.getElementById('quest-card-panel');
        if (card) card.classList.remove('focused');
        if (this.instance) {
            this.instance.setReferencePanelDimmed(false);
        }
        this.updateButtonSelection();
    }

    public open(
        quest: QuestItem,
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

        this.activeQuest = quest;
        this.activeAnchorMarker = anchorMarker || null;

        if (anchorMarker) {
            anchorMarker.classList.add('menu-active');
            anchorMarker.classList.add('hide-tooltip-override');
        }

        const questListContainer = referencePanel || document.getElementById('quest-list-panel');
        const dockCornerToUse = dockCorner || QuestList.getState().dockCorner;
        this.activeDockCorner = referencePanel ? dockCornerToUse : null;

        if (!this.instance) {
            this.instance = new FloatingCard({
                id: 'quest-card-panel',
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                screenAnchor: screenAnchor,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCornerToUse,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack,
                onButtonSelectionChange: () => this.updateButtonSelection()
            });
        } else {
            this.instance.update({
                title: quest.questName,
                bodyHtml: this.buildBodyHtml(quest),
                buttons: this.buildButtonConfigs(quest),
                screenAnchor: screenAnchor,
                anchorMarker: this.activeAnchorMarker,
                referencePanel: questListContainer,
                dockCorner: dockCornerToUse,
                returnFocusId: returnFocusId,
                onNavBack: onNavBack
            });
        }

        this.instance.open(this.activeAnchorMarker || undefined, questListContainer, dockCornerToUse);

        OverlayManager.openCard('QUEST_CARD', {
            cardElement: this.instance.getElement(),
            referencePanel: questListContainer,
            onDismiss: () => this.close(),
            takeFocus: takeFocus,
            returnFocusId: returnFocusId
        });

        const cardEl = this.instance.getElement();
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

    public positionNearMarker(): void {
        if (this.instance) {
            this.instance.updatePosition();
        }
    }

    public isOpen(): boolean {
        return !!this.instance && this.instance.isOpen();
    }

    public close(): void {
        stopVaultBoyAnimation();
        this.activeDockCorner = null;

        if (this.scrollRafId !== null) {
            cancelAnimationFrame(this.scrollRafId);
            this.scrollRafId = null;
        }

        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('menu-active');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
            mapSurface.updateViewportTransform();
        }

        if (this.instance) {
            this.instance.close();
        }

        OverlayManager.notifyCardClosed('QUEST_CARD');
    }

    public updateButtonSelection(): void {
        if (!this.instance) return;

        const card = this.instance.getElement();
        if (!card) return;

        const isCardFocused = InputRouter.getFocus() === FocusOwner.QUEST_CARD;
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
}

export const questCard = new QuestCardController();
export const QuestCard = questCard;

window.addEventListener('languageChanged', () => {
    if (questCard.isOpen() && questCard.activeQuest) {
        questCard.open(questCard.activeQuest, questCard.activeAnchorMarker || undefined, undefined, undefined, false);
    }
});
