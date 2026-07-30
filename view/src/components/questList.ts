import { mapState } from '../core/state.js';
import { QuestItem } from '../types/quests.js';
import { FocusManager } from '../systems/focusManager.js';
import { MapViewport } from './viewport.js';
import { QuestCard } from './questCard.js';

export type QuestFilterTab = 'ALL' | 'MAIN' | 'SIDE' | 'MISC';

export interface QuestListState {
    currentTab: QuestFilterTab;
    theme: '76';
    isCollapsed: boolean;
    selectedIndex: number;
    hoverIndex: number;
    selectedQuestId: number | string | null;
}

const TABS: QuestFilterTab[] = ['ALL', 'MAIN', 'SIDE', 'MISC'];

const questListState: QuestListState = {
    currentTab: 'ALL',
    theme: '76',
    isCollapsed: true,
    selectedIndex: -1,
    hoverIndex: -1,
    selectedQuestId: null
};

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
        questListState.selectedIndex = 0;
        this.render();
        this.updateSelection();
    },

    expand(targetRelativeTop: number | null = null): void {
        if (!questListState.isCollapsed) return;
        questListState.isCollapsed = false;

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        const expandedQuests = this.getVisibleQuests();
        if (questListState.selectedQuestId !== null) {
            const foundIdx = expandedQuests.findIndex(q => (q.formId ?? q.questName) === questListState.selectedQuestId);
            questListState.selectedIndex = foundIdx !== -1 ? foundIdx : 0;
        } else if (expandedQuests.length > 0) {
            questListState.selectedIndex = 0;
            questListState.selectedQuestId = expandedQuests[0].formId ?? expandedQuests[0].questName;
        } else {
            questListState.selectedIndex = -1;
            questListState.selectedQuestId = null;
        }

        const targetIndex = questListState.selectedIndex;

        FocusManager.setFocus('QUEST_LIST');
        this.render();
        this.updateSelection(false);

        if (targetRelativeTop !== null && targetIndex !== -1) {
            // Execute synchronously to prevent 1-frame blink of content and scrollbar
            const container = document.getElementById('quest-list-panel');
            if (container) {
                const listEl = container.querySelector('.ql-items-list') as HTMLElement;
                const items = container.querySelectorAll('.ql-item');
                const selectedItem = items[targetIndex] as HTMLElement;
                
                if (listEl && selectedItem) {
                    // This forces a synchronous layout calculation
                    const panelRect = container.getBoundingClientRect();
                    const listRect = listEl.getBoundingClientRect();
                    const itemRect = selectedItem.getBoundingClientRect();
                    
                    const currentRelativeTop = itemRect.top - panelRect.top;
                    const delta = currentRelativeTop - targetRelativeTop;
                    let desiredScrollTop = listEl.scrollTop + delta;
                    
                    // maxScrollTop: scroll position where item's top hits the list's top edge
                    const maxScrollTop = listEl.scrollTop + (itemRect.top - listRect.top);
                    
                    // Use the expected expanded height (332px) to avoid transition states of listRect.bottom
                    const expectedListHeight = 332;
                    const minScrollTop = maxScrollTop + itemRect.height - expectedListHeight;
                    
                    desiredScrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));
                    desiredScrollTop = Math.max(desiredScrollTop, minScrollTop);
                    
                    listEl.scrollTop = desiredScrollTop;
                    
                    // Force the thumb to sync synchronously before the browser paints
                    listEl.dispatchEvent(new Event('scroll'));
                }
            }
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
        QuestCard.close();
        MapViewport.restoreSavedViewport();
        FocusManager.setFocus('MAP');
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
                if (container) container.classList.add('focused');
            },
            onFocusLost: () => {
                const container = document.getElementById('quest-list-panel');
                if (container) container.classList.remove('focused');
            }
        });

        window.addEventListener('click', (e: MouseEvent) => {
            const container = document.getElementById('quest-list-panel');
            if (container && !container.contains(e.target as Node)) {
                if (!questListState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        this.render();
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (questListState.isCollapsed) {
            return false;
        }

        const key = e.key;
        const keyLower = key.toLowerCase();
        const quests = this.getVisibleQuests();

        if (key === 'ArrowLeft') {
            this.collapse();
            return true;
        }

        if (key === 'ArrowRight') {
            console.log('[QuestList] ArrowRight pressed. Transferring focus to QUEST_CARD.');
            FocusManager.setFocus('QUEST_CARD');
            return true;
        }

        if (keyLower === 'z') {
            const currIdx = TABS.indexOf(questListState.currentTab);
            if (currIdx > 0) {
                this.setFilterTab(TABS[currIdx - 1]);
            }
            return true;
        }

        if (keyLower === 'c') {
            const currIdx = TABS.indexOf(questListState.currentTab);
            if (currIdx < TABS.length - 1) {
                this.setFilterTab(TABS[currIdx + 1]);
            }
            return true;
        }

        if (key === 'ArrowDown') {
            if (quests.length > 0) {
                questListState.selectedIndex = Math.min(quests.length - 1, questListState.selectedIndex + 1);
                this.updateSelection();
            }
            return true;
        }

        if (key === 'ArrowUp') {
            if (quests.length > 0) {
                questListState.selectedIndex = Math.max(0, questListState.selectedIndex - 1);
                this.updateSelection();
            }
            return true;
        }

        if (keyLower === 't') {
            const selectedQuest = quests[questListState.selectedIndex];
            if (selectedQuest) {
                this.toggleQuestActive(selectedQuest);
            }
            return true;
        }

        return true;
    },

    toggleQuestActive(quest: QuestItem): void {
        quest.isTracked = !quest.isTracked;
        console.log(`[QuestList] Toggled active status for quest "${quest.questName}" -> ${quest.isTracked}`);
        if (quest.isTracked) {
            this.centerSelectedQuestTarget(quest);
        }
        this.render();
    },

    centerSelectedQuestTarget(quest: QuestItem): void {
        if (!quest.isTracked || !quest.objectives || quest.objectives.length === 0) {
            MapViewport.restoreSavedViewport();
            return;
        }
        const activeObj = quest.objectives.find(o => o.state === 1) || quest.objectives[0];
        if (!activeObj || !activeObj.targets || activeObj.targets.length === 0) {
            MapViewport.restoreSavedViewport();
            return;
        }

        const target = activeObj.targets[0];
        const bounds = mapState.currentPayloadBounds;
        if (bounds) {
            console.log(`[QuestList] Centering viewport on active quest target (${target.x}, ${target.y}) for "${quest.questName}"`);
            MapViewport.centerOnMapCoords(target.x, target.y, bounds);
        }
    },

    getVisibleQuests(): QuestItem[] {
        const quests = mapState.lastPayload?.quests || [];
        const filtered = this.filterQuests(quests, questListState.currentTab);
        if (questListState.isCollapsed) {
            return filtered.filter(q => q.isTracked && !this.isQuestCompleted(q));
        }
        const uncompleted = filtered.filter(q => !this.isQuestCompleted(q));
        const completed = filtered.filter(q => this.isQuestCompleted(q));
        return [...uncompleted, ...completed];
    },

    render(): void {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        const existingList = container.querySelector('.ql-items-list') as HTMLElement;
        const wasCollapsed = container.getAttribute('data-collapsed') === 'true';
        const isCollapsed = questListState.isCollapsed;
        const savedScrollTop = (existingList && wasCollapsed === isCollapsed) ? existingList.scrollTop : 0;

        container.setAttribute('data-collapsed', String(isCollapsed));
        container.setAttribute('data-theme', questListState.theme);

        const itemsToRender = this.getVisibleQuests();
        let itemsHtml = '';

        if (itemsToRender.length === 0) {
            itemsHtml = isCollapsed ? `<div class="ql-empty">NO ACTIVE QUESTS</div>` : '<div class="ql-empty">NO QUESTS</div>';
        } else if (isCollapsed) {
            itemsHtml = itemsToRender.map((q, idx) => this.renderQuestItem(q, idx)).join('');
        } else {
            const uncompleted = itemsToRender.filter(q => !this.isQuestCompleted(q));
            const completed = itemsToRender.filter(q => this.isQuestCompleted(q));

            let currentItemIndex = 0;
            itemsHtml += uncompleted.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
            if (uncompleted.length > 0 && completed.length > 0) {
                itemsHtml += `<div class="ql-separator"></div>`;
            }
            itemsHtml += completed.map(q => this.renderQuestItem(q, currentItemIndex++)).join('');
        }

        const collapseText = isCollapsed ? 'EXPAND' : 'COLLAPSE';
        const collapseIcon = isCollapsed ? 'U' : 'T';

        container.innerHTML = `
          <div class="ql-header">
             <div class="ql-title">QUESTS</div>
             <div class="ql-collapse-btn">
               <span class="ql-collapse-text">${collapseText}</span>
               <span class="ql-btn-icon">${collapseIcon}</span>
            </div>
          </div>
          ${!isCollapsed ? `
          <div class="ql-sub-header">
             <span class="ql-tab-nav-icon">Z)</span>
             <div class="ql-tabs-bar">
               <div class="ql-tab ${questListState.currentTab === 'ALL' ? 'active' : ''}" data-tab="ALL">
                 <span class="ql-tab-text">ALL</span>
              </div>
               <div class="ql-tab ${questListState.currentTab === 'MAIN' ? 'active' : ''}" data-tab="MAIN">
                 <span class="ql-tab-text">MAIN</span>
              </div>
               <div class="ql-tab ${questListState.currentTab === 'SIDE' ? 'active' : ''}" data-tab="SIDE">
                 <span class="ql-tab-text">SIDE</span>
              </div>
               <div class="ql-tab ${questListState.currentTab === 'MISC' ? 'active' : ''}" data-tab="MISC">
                 <span class="ql-tab-text">MISC</span>
              </div>
            </div>
             <span class="ql-tab-nav-icon">C)</span>
          </div>
          ` : ''}
          <div class="ql-body">
             <div class="ql-items-list">
               ${itemsHtml}
            </div>
             <div class="ql-scrollbar">
               <div class="ql-scrollbar-thumb"></div>
            </div>
          </div>
        `;

        const newList = container.querySelector('.ql-items-list') as HTMLElement;
        if (newList) {
            newList.scrollTop = savedScrollTop;
        }

        this.bindEvents(itemsToRender);
        this.updateSelection(false);
    },

    bindEvents(itemsToRender: QuestItem[]): void {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        container.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;

            if (target.closest('.ql-collapse-btn')) {
                this.toggleCollapse();
                return;
            }

            const tabBtn = target.closest('[data-tab]') as HTMLElement;
            if (tabBtn) {
                const tab = tabBtn.getAttribute('data-tab') as QuestFilterTab;
                if (tab) {
                    this.setFilterTab(tab);
                }
                return;
            }

            const itemEl = target.closest('[data-quest-index]') as HTMLElement;
            if (itemEl) {
                const index = parseInt(itemEl.getAttribute('data-quest-index') || '0', 10);

                if (questListState.isCollapsed) {
                    const quest = itemsToRender[index];
                    if (quest) {
                        questListState.selectedQuestId = quest.formId ?? quest.questName;
                    }
                    
                    const panelRect = container.getBoundingClientRect();
                    const itemRect = itemEl.getBoundingClientRect();
                    const targetRelativeTop = itemRect.top - panelRect.top;

                    this.expand(targetRelativeTop);
                    return;
                }

                questListState.selectedIndex = index;
                const quest = itemsToRender[index];
                if (quest) {
                    this.toggleQuestActive(quest);
                    this.centerSelectedQuestTarget(quest);
                }
            } else if (questListState.isCollapsed) {
                this.expand();
            }
        };

        const listEl = container.querySelector('.ql-items-list') as HTMLElement;
        if (listEl) {
            listEl.onmouseover = (e: MouseEvent) => {
                if ((this as any)._ignoreHover) return;
                const itemEl = (e.target as HTMLElement).closest('[data-quest-index]') as HTMLElement;
                if (itemEl) {
                    const index = parseInt(itemEl.getAttribute('data-quest-index') || '0', 10);
                    if (questListState.isCollapsed) {
                        if (questListState.hoverIndex !== index) {
                            questListState.hoverIndex = index;
                            this.updateSelection();
                        }
                    } else {
                        if (questListState.selectedIndex !== index) {
                            questListState.selectedIndex = index;
                            this.updateSelection();
                        }
                    }
                }
            };

            listEl.onmouseleave = () => {
                questListState.hoverIndex = -1;
                if (questListState.isCollapsed) {
                    this.updateSelection();
                }
            };
        }

        const thumbEl = container.querySelector('.ql-scrollbar-thumb') as HTMLElement;
        const scrollbarContainer = container.querySelector('.ql-scrollbar') as HTMLElement;
        if (listEl && thumbEl && scrollbarContainer) {
            const syncThumb = () => {
                const scrollHeight = listEl.scrollHeight;
                const clientHeight = listEl.clientHeight;
                const scrollTop = listEl.scrollTop;

                if (scrollHeight <= clientHeight) {
                    scrollbarContainer.style.display = 'none';
                } else {
                    scrollbarContainer.style.display = 'flex';
                    const trackHeight = scrollbarContainer.clientHeight || clientHeight;
                    const ratio = trackHeight / scrollHeight;
                    const thumbHeight = Math.max(30, trackHeight * ratio);
                    const maxTop = trackHeight - thumbHeight;
                    const topPos = (scrollTop / (scrollHeight - clientHeight)) * maxTop;

                    thumbEl.style.height = `${thumbHeight}px`;
                    thumbEl.style.top = `${topPos}px`;
                }
            };

            listEl.addEventListener('scroll', syncThumb);
            syncThumb();
            setTimeout(syncThumb, 0);
        }
    },

    updateSelection(autoScroll: boolean = true): void {
        const container = document.getElementById('quest-list-panel');
        if (!container) return;

        const quests = this.getVisibleQuests();

        if (questListState.isCollapsed) {
            const items = container.querySelectorAll('.ql-item');
            items.forEach((item, idx) => {
                if (idx === questListState.hoverIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            QuestCard.close();
            return;
        }

        if (quests.length > 0) {
            questListState.selectedIndex = Math.max(0, Math.min(quests.length - 1, questListState.selectedIndex));
            const selectedQuest = quests[questListState.selectedIndex];
            if (selectedQuest) {
                questListState.selectedQuestId = selectedQuest.formId ?? selectedQuest.questName;
            }
        } else {
            questListState.selectedQuestId = null;
        }

        const items = container.querySelectorAll('.ql-item');
        items.forEach((item, idx) => {
            if (idx === questListState.selectedIndex) {
                item.classList.add('selected');
                if (autoScroll) {
                    (item as HTMLElement).scrollIntoView({ block: 'nearest' });
                }
            } else {
                item.classList.remove('selected');
            }
        });

        const selectedQuest = quests[questListState.selectedIndex];
        if (selectedQuest) {
            this.centerSelectedQuestTarget(selectedQuest);
            QuestCard.open(selectedQuest);
        } else {
            QuestCard.close();
        }
    },

    isQuestCompleted(quest: QuestItem): boolean {
        if (!quest.objectives || quest.objectives.length === 0) return false;
        const hasActive = quest.objectives.some(o => o.state === 1);
        const hasCompleted = quest.objectives.some(o => o.state === 2 || o.state === 3);
        return !hasActive && hasCompleted;
    },

    filterQuests(quests: QuestItem[], tab: QuestFilterTab): QuestItem[] {
        if (tab === 'ALL') return quests;
        if (tab === 'MAIN') return quests.filter(q => q.type === 'Main');
        if (tab === 'SIDE') return quests.filter(q => q.type === 'Side');
        if (tab === 'MISC') return quests.filter(q => q.isMisc || q.type === 'Misc');
        return quests;
    },

    renderQuestItem(quest: QuestItem, index: number): string {
        const isCompleted = this.isQuestCompleted(quest);
        const isActive = quest.isTracked;
        const isSelected = !questListState.isCollapsed && index === questListState.selectedIndex;
        const keyAttr = quest.formId !== undefined ? `data-quest-formid="${quest.formId}"` : `data-quest-name="${this.escapeHtml(quest.questName)}"`;
        
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
          <div class="ql-item ${statusClass} ${isSelected ? 'selected' : ''}" data-quest-index="${index}" ${keyAttr}>
             <div class="ql-item-content">
             <div class="ql-marker-box ${statusClass}"></div>
             <div class="ql-item-title">${this.escapeHtml(displayName)}</div>
            </div>
          </div>
        `;
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
