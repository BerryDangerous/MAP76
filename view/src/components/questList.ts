import { mapState } from '../core/state.js';
import { QuestItem } from '../types/quests.js';
import { FocusManager } from '../systems/focusManager.js';
import { MapViewport } from './viewport.js';
import { QuestCard } from './questCard.js';
import { toggleQuestActive } from '../core/bridge.js';
import { SelectableListController } from '../ui/selectableListController.js';
import { TabBar } from '../ui/tabBar.js';
import { CollapsiblePanel } from '../ui/collapsiblePanel.js';
import { CustomScrollbar } from '../ui/customScrollbar.js';
import { KeybindsSystem } from '../systems/keybinds.js';
import { DockControlsSystem, DockCorner } from '../systems/dockControls.js';
import { QuestUtils } from '../utils/questUtils.js';
import { StringUtils } from '../utils/stringUtils.js';

export type QuestFilterTab = 'ALL' | 'MAIN' | 'SIDE' | 'MISC';

export interface QuestListState {
    currentTab: QuestFilterTab;
    theme: '76';
    isCollapsed: boolean;
    hoverIndex: number;
    selectedQuestId: number | string | null;
    dockCorner: DockCorner;
}

const questListState: QuestListState = {
    currentTab: 'ALL',
    theme: '76',
    isCollapsed: true,
    hoverIndex: -1,
    selectedQuestId: null,
    dockCorner: 'top-left'
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
            QuestCard.close();
        }

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }
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

const tabBar = new TabBar<QuestFilterTab>({
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

    setTheme(theme: '76'): void {
        questListState.theme = theme;
        const container = document.getElementById('quest-list-panel');
        if (container) {
            container.setAttribute('data-theme', theme);
        }
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
            QuestCard.close();
            MapViewport.restoreSavedViewport();
            return;
        }
        questListState.isCollapsed = true;
        questListState.hoverIndex = -1;
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        QuestCard.close();
        MapViewport.restoreSavedViewport();
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
        FocusManager.register({
            id: 'QUEST_LIST',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const container = document.getElementById('quest-list-panel');
                if (container) { container.classList.add('focused'); container.classList.add('collapsible-panel'); }
            },
            onFocusLost: (newFocusId?: string) => {
                const container = document.getElementById('quest-list-panel');
                if (container) container.classList.remove('focused');
                if (newFocusId !== 'QUEST_CARD' && !questListState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        window.addEventListener('click', (e: MouseEvent) => {
            const container = document.getElementById('quest-list-panel');
            const card = document.getElementById('quest-card-panel');
            const targetNode = e.target as Node;
            
            if (container && !container.contains(targetNode) && (!card || !card.contains(targetNode))) {
                if (!questListState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        this.render();
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (questListState.isCollapsed) {
            if (DockControlsSystem.isExpandKey(e, questListState.dockCorner)) {
                this.expand();
                return true;
            }
            return false;
        }

        const quests = this.getVisibleQuests();

        if (DockControlsSystem.isCollapseKey(e, questListState.dockCorner)) {
            this.collapse();
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_RIGHT')) {
            FocusManager.setFocus('QUEST_CARD');
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

        if (KeybindsSystem.isAction(e, 'TOGGLE_TRACKING')) {
            const selectedQuest = listController.getSelectedItem();
            if (selectedQuest) {
                this.toggleQuestActive(selectedQuest);
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            this.collapse();
            return true;
        }

        return false;
    },

    toggleQuestActive(quest: QuestItem): void {
        quest.isTracked = !quest.isTracked;
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
            MapViewport.restoreSavedViewport();
            return;
        }
        const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
        if (!activeObj || !activeObj.targets || activeObj.targets.length === 0) {
            MapViewport.restoreSavedViewport();
            return;
        }

        const target = activeObj.targets[0];
        MapViewport.centerOnWorldCoords(target.x, target.y);
    },

    getVisibleQuests(): QuestItem[] {
        const quests = mapState.lastPayload?.quests || [];
        const filtered = this.filterQuests(quests, questListState.currentTab);
        if (questListState.isCollapsed) {
            return filtered.filter(q => q.isTracked && !QuestUtils.isQuestCompleted(q));
        }
        const uncompleted = filtered.filter(q => !QuestUtils.isQuestCompleted(q));
        const completed = filtered.filter(q => QuestUtils.isQuestCompleted(q));
        return [...uncompleted, ...completed];
    },

    mountLayout(container: HTMLElement): void {
        container.classList.add('collapsible-panel');
        container.classList.add('selectable-list');
        container.innerHTML = `
          <div class="cp-header">
             <div class="cp-title">QUESTS</div>
             <div class="cp-collapse-btn">
               <span class="cp-collapse-text">COLLAPSE</span>
               <span class="cp-btn-icon"></span>
            </div>
          </div>
          <div class="tb-sub-header">
             <span class="tb-nav-icon">Z)</span>
             <div class="tb-tabs-bar"></div>
             <span class="tb-nav-icon">C)</span>
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

        DockControlsSystem.applyDockPosition(container, questListState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
        }

        const isCollapsed = questListState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));
        container.setAttribute('data-theme', questListState.theme);

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? 'EXPAND' : 'COLLAPSE';
        }

        const titleEl = container.querySelector('.cp-title');
        if (titleEl) {
            if (isCollapsed && questListState.currentTab !== 'ALL') {
                titleEl.textContent = `QUESTS - ${questListState.currentTab}`;
            } else {
                titleEl.textContent = 'QUESTS';
            }
        }

        const subHeader = container.querySelector('.tb-sub-header') as HTMLElement;
        if (subHeader) {
            subHeader.style.display = isCollapsed ? 'none' : 'flex';
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
            const tabName = questListState.currentTab === 'ALL' ? '' : `${questListState.currentTab} `;
            itemsHtml = isCollapsed ? `<div class="sl-empty">NO ACTIVE ${tabName}QUESTS</div>` : `<div class="sl-empty">NO ${tabName}QUESTS</div>`;
        } else if (isCollapsed) {
            itemsHtml = itemsToRender.map((q, idx) => this.renderQuestItem(q, idx)).join('');
        } else {
            const uncompleted = itemsToRender.filter(q => !QuestUtils.isQuestCompleted(q));
            const completed = itemsToRender.filter(q => QuestUtils.isQuestCompleted(q));

            let currentItemIndex = 0;
            itemsHtml += uncompleted.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
            if (uncompleted.length > 0 && completed.length > 0) {
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
            QuestCard.close();
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
        
        let statusClass = 'inactive';
        if (isCompleted) {
            statusClass = 'completed';
        } else if (isActive) {
            statusClass = 'active';
        }

        let displayName = quest.questName;
        if ((quest.isMisc || quest.type === 'Misc') && quest.objectives && quest.objectives.length > 0) {
            const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
            if (activeObj && activeObj.text) {
                displayName = activeObj.text;
            }
        }

        return `
          <div class="sl-item ${statusClass} ${isSelected ? 'selected' : ''}" data-quest-index="${index}" ${keyAttr}>
             <div class="sl-item-content">
             <div class="sl-marker-box ${statusClass}"></div>
             <div class="sl-item-title">${StringUtils.escapeHtml(displayName)}</div>
            </div>
          </div>
        `;
    }
};
