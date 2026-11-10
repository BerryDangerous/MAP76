import { QuestItem } from '@/types/quests.js';

import { t } from '@/core/i18n.js';
import { toggleQuestActive } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, KeybindsSystem, type ControlActionHint } from '@/input/index.js';

import { anchorToCorner, getCornerConfig, Corner } from '@/overlays/positioning.js';
import { SelectableListController } from '@/systems/listController.js';
import { SoundService } from '@/services/soundService.js';

import { mapSurface } from '@/map/index.js';

import { QuestUtils } from '@/overlays/domain/questRules.js';
import { StringUtils } from '@/utils/stringUtils.js';

import { CollapsiblePanel, CustomScrollbar, TabBar } from '@/ui/index.js';

export type QuestFilterTab = 'ALL' | 'MAIN' | 'SIDE' | 'MISC';
export type QuestSortMode = 'RECENT' | 'ALPHABETICAL' | 'ACTIVE';

export interface QuestListState {
    currentTab: QuestFilterTab;
    sortMode: QuestSortMode;
    isCollapsed: boolean;
    hoverIndex: number;
    selectedQuestId: number | string | null;
    dockCorner: Corner;
}

const questListState: QuestListState = {
    currentTab: 'ALL',
    sortMode: 'RECENT',
    isCollapsed: true,
    hoverIndex: -1,
    selectedQuestId: null,
    dockCorner: 'top-right'
};

const listController = new SelectableListController<QuestItem>({
    getItems: () => QuestList.getVisibleQuests(),
    getItemId: (quest) => quest.formId ?? quest.questName,
    containerSupplier: () => document.getElementById('quest-list-panel'),
    itemSelector: '.sl-item',
    onSelectionChange: (selectedQuest) => {
        if (questListState.isCollapsed) return;

        if (selectedQuest) {
            questListState.selectedQuestId = selectedQuest.formId ?? selectedQuest.questName;
            QuestList.notifyQuestFocused(selectedQuest);
            QuestList.onSelectionChange?.(selectedQuest);
        } else {
            questListState.selectedQuestId = null;
            QuestList.onSelectionChange?.(null);
            QuestList.closeCards();
        }

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }

        InputRouter.notifyActionsChanged();
    },
    onItemClick: (quest, index) => {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        InputRouter.push(FocusOwner.QUEST_LIST);

        if (index === -2) {
            QuestList.collapse();
            return;
        }

        if (index === -1 || questListState.isCollapsed) {
            if (quest) {
                questListState.selectedQuestId = quest.formId ?? quest.questName;
            }
            const isBottomDocked = questListState.dockCorner.startsWith('bottom');
            const panelRect = container.getBoundingClientRect();
            const items = container.querySelectorAll('.sl-item');
            const itemEl = (index >= 0 && items[index]) ? items[index] as HTMLElement : null;
            const itemRect = itemEl ? itemEl.getBoundingClientRect() : panelRect;
            const targetRelativeOffset = isBottomDocked ? (panelRect.bottom - itemRect.bottom) : (itemRect.top - panelRect.top);

            QuestList.expand(targetRelativeOffset);
            return;
        }

        listController.setSelectedIndex(index, false);
        QuestList.onFlushScheduledCard?.();
        if (quest) {
            QuestList.toggleQuestActive(quest);
        }
    },
    onItemHover: (quest, index) => {
        if ((QuestList as any)._ignoreHover) return;
        if (questListState.isCollapsed) {
            if (questListState.hoverIndex !== index) {
                if (index !== -1) SoundService.playFocus();
                questListState.hoverIndex = index;
                QuestList.updateSelection();
            }
        } else {
            if (index !== -1 && listController.getSelectedIndex() !== index) {
                listController.setSelectedIndex(index, true, false);
            }
        }
    }
});

let tabBar = new TabBar<QuestFilterTab>({
    tabs: [
        { id: 'ALL', label: 'ALL' },
        { id: 'MAIN', label: 'MAIN' },
        { id: 'SIDE', label: 'SIDE' },
        { id: 'MISC', label: 'MISC' }
    ],
    activeTabId: 'ALL',
    onTabChange: (tabId) => {
        QuestList.setFilterTab(tabId);
    }
});

let collapsiblePanel: CollapsiblePanel | null = null;
let customScrollbar: CustomScrollbar | null = null;
let isLayoutMounted = false;

export const QuestList = {
    onExpanded: null as (() => void) | null,
    onSelectionChange: null as ((quest: QuestItem | null) => void) | null,
    onNavigateToDockedCard: null as (() => boolean) | null,
    onRequestCloseCards: null as (() => void) | null,
    onFlushScheduledCard: null as (() => void) | null,

    getState(): QuestListState {
        return questListState;
    },

    closeCards(): void {
        this.onRequestCloseCards?.();
    },

    isSelectedQuestCompleted(): boolean {
        if (questListState.isCollapsed) return false;
        const selected = listController.getSelectedItem();
        if (!selected) return false;
        return QuestUtils.isQuestCompleted(selected);
    },

    setFilterTab(tab: QuestFilterTab): void {
        questListState.currentTab = tab;
        listController.setSelectedIndex(0, false);
        this.render();
        this.updateSelection();
    },

    expand(targetRelativeOffset: number | null = null): void {
        if (!questListState.isCollapsed) return;
        questListState.isCollapsed = false;

        this.onExpanded?.();

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(false);
        }

        const expandedQuests = this.getVisibleQuests();
        let targetIndex = 0;
        if (questListState.selectedQuestId !== null) {
            const foundIdx = expandedQuests.findIndex(q => (q.formId ?? q.questName) === questListState.selectedQuestId);
            targetIndex = foundIdx !== -1 ? foundIdx : 0;
        } else if (expandedQuests.length > 0) {
            targetIndex = 0;
            questListState.selectedQuestId = expandedQuests[0].formId ?? expandedQuests[0].questName;
        } else {
            targetIndex = -1;
            questListState.selectedQuestId = null;
        }

        listController.setSelectedIndex(targetIndex, false, false);

        InputRouter.push(FocusOwner.QUEST_LIST);
        this.render();
        this.updateSelection(false);

        if (targetRelativeOffset !== null && targetIndex !== -1) {
            listController.scrollItemToRelativeOffset(targetIndex, targetRelativeOffset);
        }
    },

    collapse(): void {
        if (questListState.isCollapsed) {
            this.closeCards();
            mapSurface.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        questListState.isCollapsed = true;
        questListState.hoverIndex = -1;
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        this.closeCards();
        mapSurface.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);

        InputRouter.remove(FocusOwner.QUEST_LIST);

        const container = document.getElementById('quest-list-panel');
        if (container) {
            container.classList.remove('focused');
            container.classList.remove('dimmed');
        }
        this.render();
    },

    toggleCollapse(): void {
        if (questListState.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    },

    id: FocusOwner.QUEST_LIST,

    handleAction(action: KeyAction): boolean {
        if (questListState.isCollapsed) return false;

        const quests = this.getVisibleQuests();
        const isRightDocked = questListState.dockCorner.includes('right');

        switch (action) {
            case KeyAction.NAV_BACK:
            case KeyAction.COLLAPSE:
                this.collapse();
                SoundService.playFocus();
                return true;

            case KeyAction.NAV_LEFT:
                if (isRightDocked) {
                    if (this.onNavigateToDockedCard?.()) {
                        return true;
                    }
                } else {
                    this.collapse();
                    SoundService.playFocus();
                    return true;
                }
                return true;

            case KeyAction.NAV_RIGHT:
                if (!isRightDocked) {
                    if (this.onNavigateToDockedCard?.()) {
                        return true;
                    }
                } else {
                    this.collapse();
                    SoundService.playFocus();
                    return true;
                }
                return true;

            case KeyAction.TAB_PREV:
                tabBar.prevTab();
                return true;

            case KeyAction.TAB_NEXT:
                tabBar.nextTab();
                return true;

            case KeyAction.NAV_DOWN:
                if (quests.length > 0) {
                    listController.navigateNext();
                }
                return true;

            case KeyAction.NAV_UP:
                if (quests.length > 0) {
                    listController.navigatePrev();
                }
                return true;

            case KeyAction.TOGGLE_ACTIVE: {
                const selectedQuest = listController.getSelectedItem();
                if (selectedQuest) {
                    this.toggleQuestActive(selectedQuest);
                }
                return true;
            }

            case KeyAction.SORT: {
                const modes: QuestSortMode[] = ['RECENT', 'ALPHABETICAL', 'ACTIVE'];
                const nextIdx = (modes.indexOf(questListState.sortMode) + 1) % modes.length;
                questListState.sortMode = modes[nextIdx];
                SoundService.playFocus();
                this.render();
                InputRouter.notifyActionsChanged();
                return true;
            }

            case KeyAction.SELECT: {
                if (this.onNavigateToDockedCard?.()) {
                    return true;
                }
                return true;
            }

            case KeyAction.CENTER_ITEM: {
                const selected = listController.getSelectedItem();
                if (selected && !QuestUtils.isQuestCompleted(selected)) {
                    SoundService.playShowOnMap();
                    this.onSelectionChange?.(selected);
                    const firstTarget = selected.objectives?.find(o => o.targets && o.targets.length > 0)?.targets[0];
                    if (firstTarget) {
                        mapSurface.centerOnTarget(firstTarget.worldspace, firstTarget.x, firstTarget.y, firstTarget.z);
                    }
                }
                return true;
            }

            default:
                return false;
        }
    },

    getAvailableControls(): ControlActionHint[] {
        const sortLabel = `${t('controls.actions.sort')} (${t(`quests.sortMode.${questListState.sortMode.toLowerCase()}`)})`;
        const controls: ControlActionHint[] = [
            KeyAction.NAV_BACK,
            KeyAction.NAV_UP,
            KeyAction.NAV_DOWN,
            KeyAction.PAN_MOUSE,
            { action: KeyAction.SORT, label: sortLabel }
        ];
        const selected = listController.getSelectedItem();
        if (selected) {
            const isCompleted = QuestUtils.isQuestCompleted(selected);
            if (!isCompleted) {
                controls.push(KeyAction.TOGGLE_ACTIVE);
                if (QuestUtils.hasActiveTargets(selected)) {
                    controls.push(KeyAction.CENTER_ITEM);
                }
            }
        }
        controls.push(KeyAction.SELECT);
        return controls;
    },

    onFocusGained(): void {
        const container = document.getElementById('quest-list-panel');
        if (container) {
            container.classList.add('focused');
            container.classList.add('collapsible-panel');
        }
    },

    onFocusLost(): void {
        const container = document.getElementById('quest-list-panel');
        if (container) container.classList.remove('focused');
    },

    init(): void {
        tabBar.updateTabs([
            { id: 'ALL', label: t('quests.tabs.all') },
            { id: 'MAIN', label: t('quests.tabs.main') },
            { id: 'SIDE', label: t('quests.tabs.side') },
            { id: 'MISC', label: t('quests.tabs.misc') }
        ]);

        InputRouter.register(this);

        window.addEventListener('languageChanged', () => {
            this.reloadLocales();
        });

        this.render();
    },

    reloadLocales(): void {
        const container = document.getElementById('quest-list-panel');
        if (container) {
            tabBar.updateTabs([
                { id: 'ALL', label: t('quests.tabs.all') },
                { id: 'MAIN', label: t('quests.tabs.main') },
                { id: 'SIDE', label: t('quests.tabs.side') },
                { id: 'MISC', label: t('quests.tabs.misc') }
            ]);
            this.render();
        }
    },

    toggleQuestActive(quest: QuestItem): void {
        quest.isTracked = !quest.isTracked;
        quest.isTracked ? SoundService.playQuestActive() : SoundService.playQuestInactive();
        if (quest.formId !== undefined) {
            toggleQuestActive(quest.formId);
        }
        if (quest.isTracked) {
            this.notifyQuestFocused(quest);
        }
        this.render();
    },

    notifyQuestFocused(quest: QuestItem | null): void {
        if (!quest || !quest.isTracked || !quest.objectives || quest.objectives.length === 0) {
            mapSurface.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }
        const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
        if (!activeObj || !activeObj.targets || activeObj.targets.length === 0) {
            mapSurface.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }

        const target = activeObj.targets[0];
        if (appSettings.focusMarkerOnSelection) {
            mapSurface.centerOnTarget(target.worldspace, target.x, target.y, target.z);
        }
    },

    sortQuests(quests: QuestItem[], sortMode: QuestSortMode): QuestItem[] {
        let sorted = [...quests];
        if (sortMode === 'ALPHABETICAL') {
            sorted.sort((a, b) => a.questName.localeCompare(b.questName));
        } else if (sortMode === 'ACTIVE') {
            sorted.sort((a, b) => (b.isTracked ? 1 : 0) - (a.isTracked ? 1 : 0));
        }
        return sorted;
    },

    getVisibleQuests(): QuestItem[] {
        const quests = [...(domainState.lastPayload?.quests || [])].reverse();
        const filtered = this.filterQuests(quests, questListState.currentTab);
        const sorted = this.sortQuests(filtered, questListState.sortMode);

        if (questListState.isCollapsed) {
            const active = sorted.filter(q => q.isTracked && !QuestUtils.isQuestCompleted(q));
            const activeNonMisc = active.filter(q => !q.isMisc && q.type !== 'Misc');
            const activeMisc = active.filter(q => q.isMisc || q.type === 'Misc');
            return [...activeNonMisc, ...activeMisc];
        }

        const uncompletedNonMisc = sorted.filter(q => !QuestUtils.isQuestCompleted(q) && !q.isMisc && q.type !== 'Misc');
        const uncompletedMisc = sorted.filter(q => !QuestUtils.isQuestCompleted(q) && (q.isMisc || q.type === 'Misc'));
        const completed = sorted.filter(q => QuestUtils.isQuestCompleted(q));
        return [...uncompletedNonMisc, ...uncompletedMisc, ...completed];
    },

    mountLayout(container: HTMLElement): void {
        container.classList.add('collapsible-panel');
        container.classList.add('selectable-list');
        container.innerHTML = `
          <div class="cp-header">
             <div class="cp-title">${t('quests.title')}</div>
             <div class="cp-collapse-btn">
               <span class="cp-collapse-text">${t('controls.collapse')}</span>
               <span class="cp-btn-icon"></span>
            </div>
          </div>
          <div class="tb-sub-header">
             <span class="tb-nav-icon"></span>
             <div class="tb-tabs-bar"></div>
             <span class="tb-nav-icon"></span>
          </div>
          <div class="sl-body">
             <div class="sl-items-list"></div>
             <div class="sl-scrollbar">
               <div class="sl-scrollbar-thumb"></div>
            </div>
          </div>
        `;

        const tabsBarContainer = container.querySelector('.tb-tabs-bar') as HTMLElement;
        if (tabsBarContainer) {
            tabBar.mount(tabsBarContainer);
        }

        collapsiblePanel = new CollapsiblePanel({
            panelElement: container,
            collapseBtnElement: container.querySelector('.cp-collapse-btn') as HTMLElement,
            dockCorner: questListState.dockCorner,
            initiallyCollapsed: questListState.isCollapsed,
            onToggle: (collapsed) => {
                if (collapsed) this.collapse();
                else this.expand();
            }
        });

        isLayoutMounted = true;
    },

    render(): void {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        anchorToCorner(container, questListState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
        }

        const isCollapsed = questListState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? t('controls.expand') : t('controls.collapse');
        }

        const titleEl = container.querySelector('.cp-title');
        if (titleEl) {
            if (isCollapsed && questListState.currentTab !== 'ALL') {
                const tabLabel = t(`quests.tabs.${questListState.currentTab.toLowerCase()}`);
                titleEl.textContent = `${t('quests.title')} - ${tabLabel}`;
            } else {
                titleEl.textContent = t('quests.title');
            }
        }

        if (collapsiblePanel) {
            collapsiblePanel.updateGlyph();
        }

        const listEl = container.querySelector('.sl-items-list') as HTMLElement;
        if (!listEl) return;

        const savedScrollTop = listEl.scrollTop;
        const itemsToRender = this.getVisibleQuests();
        let itemsHtml = '';

        if (itemsToRender.length === 0) {
            const tabKey = questListState.currentTab.toLowerCase();
            const emptyKey = isCollapsed ? `quests.emptyActive.${tabKey}` : `quests.empty.${tabKey}`;
            itemsHtml = `<div class="sl-empty">${t(emptyKey)}</div>`;
        } else if (isCollapsed) {
            const activeNonMisc = itemsToRender.filter(q => !q.isMisc && q.type !== 'Misc');
            const activeMisc = itemsToRender.filter(q => q.isMisc || q.type === 'Misc');

            let currentItemIndex = 0;
            itemsHtml += activeNonMisc.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
            
            if (activeNonMisc.length > 0 && activeMisc.length > 0) {
                itemsHtml += `<div class="sl-separator"></div>`;
            }
            itemsHtml += activeMisc.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
        } else {
            const uncompletedNonMisc = itemsToRender.filter(q => !QuestUtils.isQuestCompleted(q) && !q.isMisc && q.type !== 'Misc');
            const uncompletedMisc = itemsToRender.filter(q => !QuestUtils.isQuestCompleted(q) && (q.isMisc || q.type === 'Misc'));
            const completed = itemsToRender.filter(q => QuestUtils.isQuestCompleted(q));

            let currentItemIndex = 0;
            itemsHtml += uncompletedNonMisc.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
            
            if (uncompletedNonMisc.length > 0 && uncompletedMisc.length > 0) {
                itemsHtml += `<div class="sl-separator"></div>`;
            }
            itemsHtml += uncompletedMisc.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
            
            if ((uncompletedNonMisc.length > 0 || uncompletedMisc.length > 0) && completed.length > 0) {
                itemsHtml += `<div class="sl-separator"></div>`;
            }
            itemsHtml += completed.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
        }

        listEl.innerHTML = itemsHtml;
        listEl.scrollTop = savedScrollTop;

        const track = container.querySelector('.sl-scrollbar') as HTMLElement;
        const thumb = container.querySelector('.sl-scrollbar-thumb') as HTMLElement;

        if (track && thumb) {
            if (!customScrollbar) {
                customScrollbar = new CustomScrollbar({
                    container,
                    content: listEl,
                    track,
                    thumb
                });
            }
            customScrollbar.updateThumbPosition();
        }

        listController.bindEventDelegation();
        this.updateSelection(false);
    },

    updateSelection(autoScroll: boolean = true): void {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        if (questListState.isCollapsed) {
            const items = container.querySelectorAll('.sl-item');
            items.forEach((item, idx) => {
                if (idx === questListState.hoverIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            QuestList.closeCards();
            if (customScrollbar) {
                customScrollbar.updateThumbPosition();
            }
            return;
        }

        listController.setSelectedIndex(listController.getSelectedIndex(), true, autoScroll);
    },

    filterQuests(quests: QuestItem[], tab: QuestFilterTab): QuestItem[] {
        if (tab === 'ALL') return quests;
        if (tab === 'MAIN') return quests.filter(q => q.type === 'Main');
        if (tab === 'SIDE') return quests.filter(q => q.type !== 'Main' && q.type !== 'Misc' && !q.isMisc);
        if (tab === 'MISC') return quests.filter(q => q.isMisc || q.type === 'Misc');
        return quests;
    },

    renderQuestItem(quest: QuestItem, index: number): string {
        const isCompleted = QuestUtils.isQuestCompleted(quest);
        const isActive = quest.isTracked;
        const isSelected = !questListState.isCollapsed && index === listController.getSelectedIndex();
        const keyAttr = quest.formId !== undefined ? `data-quest-formid="${quest.formId}"` : `data-quest-name="${StringUtils.escapeHtml(quest.questName)}"`;
        const isMisc = quest.isMisc || quest.type === 'Misc';
        
        let statusClass = 'inactive';
        if (isCompleted) {
            statusClass = 'completed';
        } else if (isActive) {
            statusClass = 'active';
        }

        let displayName = quest.questName;
        if (isMisc && quest.objectives && quest.objectives.length > 0) {
            const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
            if (activeObj && activeObj.text) {
                displayName = activeObj.text;
            }
        }

        let objectivesHtml = '';
        if (isActive && !isMisc && quest.objectives && quest.objectives.length > 0) {
            const activeObjs = quest.objectives.filter(o => o.state === 1);
            if (activeObjs.length > 0) {
                objectivesHtml = `
                    <div class="sl-item-subtitle" style="font-size: 0.9em; opacity: 0.85; margin-top: 1px; white-space: normal; line-height: 1.2;">
                        ${activeObjs.map(o => `<div class="ql-objective-text">- ${StringUtils.escapeHtml(o.text)}</div>`).join('')}
                    </div>
                `;
            }
        }

        const styleAttr = (isMisc || isCompleted) ? '' : 'style="height: auto; min-height: 50px; padding-top: 4px; padding-bottom: 4px;"';

        return `
          <div class="sl-item ${statusClass} ${isSelected ? 'selected' : ''}" data-quest-index="${index}" ${keyAttr} ${styleAttr}>
             <div class="sl-item-content">
                 <div class="sl-marker-box ${statusClass}"></div>
                 <div class="ql-text-container" style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
                     <div class="sl-item-title">${StringUtils.escapeHtml(displayName)}</div>
                     ${objectivesHtml}
                 </div>
            </div>
          </div>
        `;
    }
};
