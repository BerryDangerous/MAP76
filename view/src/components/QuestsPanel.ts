import { QuestItem } from '@/types/quests.js';

import { t } from '@/core/i18n.js';
import { toggleQuestActive, EngineBridge } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager, Corner } from '@/systems/layoutManager.js';
import { SelectableListController } from '@/systems/listController.js';
import { MapViewport } from '@/systems/viewport.js';
import { OverlayManager } from '@/managers/overlayManager.js';

import { QuestUtils } from '@/utils/questUtils.js';
import { StringUtils } from '@/utils/stringUtils.js';

import { QuestCard } from '@/components/QuestCard.js';

import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel.js';
import { CustomScrollbar } from '@/components/ui/Scrollbar.js';
import { TabBar } from '@/components/ui/TabBar.js';

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
            const container = document.getElementById('quest-list-panel');
            QuestCard.open(selectedQuest, undefined, container || undefined, questListState.dockCorner, false, 'QUEST_LIST', () => QuestList.collapse());
        } else {
            questListState.selectedQuestId = null;
            QuestList.closeCards();
        }

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }

        FocusManager.triggerControlsUpdate();
    },
    onItemClick: (quest, index) => {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        FocusManager.setFocus('QUEST_LIST');

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
        if (quest) {
            QuestList.toggleQuestActive(quest);
        }
    },
    onItemHover: (quest, index) => {
        if ((QuestList as any)._ignoreHover) return;
        if (questListState.isCollapsed) {
            if (questListState.hoverIndex !== index) {
                if (index !== -1) EngineBridge.emitSound('UIGeneralFocus');
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
    getState(): QuestListState {
        return questListState;
    },

    closeCards(): void {
        const container = document.getElementById('quest-list-panel');
        if (container) OverlayManager.dismissCardIfAnchoredTo(container);
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

        FocusManager.setFocus('QUEST_LIST');
        this.render();
        this.updateSelection(false);

        if (targetRelativeOffset !== null && targetIndex !== -1) {
            listController.scrollItemToRelativeOffset(targetIndex, targetRelativeOffset);
        }
    },

    collapse(): void {
        if (questListState.isCollapsed) {
            this.closeCards();
            MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        questListState.isCollapsed = true;
        questListState.hoverIndex = -1;
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        this.closeCards();
        MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
        if (FocusManager.getFocus() === 'QUEST_LIST') {
            FocusManager.setFocus('MAP');
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

    init(): void {
        tabBar.updateTabs([
            { id: 'ALL', label: t('quests.tabs.all') },
            { id: 'MAIN', label: t('quests.tabs.main') },
            { id: 'SIDE', label: t('quests.tabs.side') },
            { id: 'MISC', label: t('quests.tabs.misc') }
        ]);

        FocusManager.register({
            id: 'QUEST_LIST',
            getAvailableControls: () => {
                const sortLabel = `${t('controls.actions.sort')} (${t(`quests.sortMode.${questListState.sortMode.toLowerCase()}`)})`;
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', 'NAV_UP', 'NAV_DOWN', 'PAN_MOUSE', { action: 'SORT', label: sortLabel }];
                const selected = listController.getSelectedItem();
                if (selected) {
                    const isCompleted = QuestUtils.isQuestCompleted(selected);
                    if (!isCompleted) {
                        controls.push('TOGGLE_ACTIVE');
                        if (QuestUtils.hasActiveTargets(selected)) {
                            controls.push('CENTER_ITEM');
                        }
                    }
                }
                controls.push('SELECT');
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const container = document.getElementById('quest-list-panel');
                if (container) { container.classList.add('focused'); container.classList.add('collapsible-panel'); }
            },
            onFocusLost: (newFocusId?: string) => {
                const container = document.getElementById('quest-list-panel');
                if (container) container.classList.remove('focused');
            }
        });

        const container = document.getElementById('quest-list-panel');
        if (container) {
            OverlayManager.registerPanel('QUEST_LIST', container, () => this.collapse());
        }

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

    handleKeyDown(e: KeyboardEvent): boolean {
        if (questListState.isCollapsed) {
            const config = LayoutManager.getCornerConfig(questListState.dockCorner);
            if (KeybindsSystem.isPanelExpandKey(e, config.expandKey)) {
                this.expand();
                return true;
            }
            return false;
        }

        const quests = this.getVisibleQuests();
        const config = LayoutManager.getCornerConfig(questListState.dockCorner);
        if (KeybindsSystem.isPanelCollapseKey(e, config.collapseKey)) {
            this.collapse();
            return true;
        }

        const isRightDocked = questListState.dockCorner.includes('right');
        if (KeybindsSystem.isAction(e, 'SELECT') || (isRightDocked ? KeybindsSystem.isAction(e, 'NAV_LEFT') : KeybindsSystem.isAction(e, 'NAV_RIGHT'))) {
            if (QuestCard.isOpen()) {
                FocusManager.setFocus('QUEST_CARD');
                EngineBridge.emitSound('UIGeneralFocus');
            }
            return true;
        }

        if (tabBar.handleKeyDown(e)) {
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            if (quests.length > 0) {
                listController.navigateNext();
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_UP')) {
            if (quests.length > 0) {
                listController.navigatePrev();
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'TOGGLE_ACTIVE')) {
            const selectedQuest = listController.getSelectedItem();
            if (selectedQuest) {
                this.toggleQuestActive(selectedQuest);
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'SORT')) {
            const modes: QuestSortMode[] = ['RECENT', 'ALPHABETICAL', 'ACTIVE'];
            const nextIdx = (modes.indexOf(questListState.sortMode) + 1) % modes.length;
            questListState.sortMode = modes[nextIdx];
            EngineBridge.emitSound('UIGeneralFocus');
            this.render();
            FocusManager.triggerControlsUpdate();
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            this.collapse();
            return true;
        }

        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            const selected = listController.getSelectedItem();
            if (selected && !QuestUtils.isQuestCompleted(selected)) {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                QuestCard.open(selected, undefined, undefined, questListState.dockCorner, false, 'QUEST_LIST', () => QuestList.collapse());
                const firstTarget = selected.objectives?.find(o => o.targets && o.targets.length > 0)?.targets[0];
                if (firstTarget) {
                    MapViewport.centerOnTarget(firstTarget.worldspace, firstTarget.x, firstTarget.y, firstTarget.z);
                }
            }
            return true;
        }

        return false;
    },

    toggleQuestActive(quest: QuestItem): void {
        quest.isTracked = !quest.isTracked;
        EngineBridge.emitSound(quest.isTracked ? 'UIPipBoyQuestActive' : 'UIPipBoyQuestInactive');
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
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }
        const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
        if (!activeObj || !activeObj.targets || activeObj.targets.length === 0) {
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }

        const target = activeObj.targets[0];
        if (appSettings.focusMarkerOnSelection) {
            MapViewport.centerOnTarget(target.worldspace, target.x, target.y, target.z);
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
        const quests = [...(mapState.lastPayload?.quests || [])].reverse();
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

        LayoutManager.anchorToCorner(container, questListState.dockCorner);

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
