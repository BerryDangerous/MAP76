import { SearchResult } from '@/types/search.js';

import { EngineBridge } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { ThemeEngine } from '@/systems/assetManager.js';
import { DockControlsSystem, DockCorner } from '@/systems/dockControls.js';
import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { SelectableListController } from '@/systems/listController.js';
import { SearchEngine } from '@/systems/searchEngine.js';
import { MapViewport } from '@/systems/viewport.js';

import { QuestUtils } from '@/utils/questUtils.js';
import { SearchUtils } from '@/utils/searchUtils.js';
import { StringUtils } from '@/utils/stringUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { QuestCard } from '@/components/QuestCard.js';
import { QuestList } from '@/components/QuestsPanel.js';
import { SettlementCard } from '@/components/SettlementCard.js';

import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel.js';
import { CustomScrollbar } from '@/components/ui/Scrollbar.js';
import { SearchBox } from '@/components/ui/SearchBox.js';

export interface SearchPanelState {
    isCollapsed: boolean;
    dockCorner: DockCorner;
    searchTerm: string;
    results: SearchResult[];
}

const searchPanelState: SearchPanelState = {
    isCollapsed: true,
    dockCorner: 'top-left',
    searchTerm: '',
    results: []
};

let collapsiblePanel: CollapsiblePanel | null = null;
let customScrollbar: CustomScrollbar | null = null;
let searchBox: SearchBox | null = null;
let isLayoutMounted = false;

const listController = new SelectableListController<SearchResult>({
    getItems: () => SearchPanel.getVisibleResults(),
    getItemId: (result) => result.id,
    containerSupplier: () => document.getElementById('search-panel'),
    itemSelector: '.sl-item',
    onSelectionChange: (selectedResult) => {
        if (searchPanelState.isCollapsed) return;
        
        SearchPanel.closeCards();

        if (selectedResult) {
            SearchPanel.openCardForResult(selectedResult);
            if (selectedResult.markerCoords) {
                if (appSettings.focusMarkerOnSelection) {
                    let targetX = selectedResult.markerCoords.x;
                    let targetY = selectedResult.markerCoords.y;
                    const currentWs = mapState.activeMapConfig?.worldspaceID ?? 0;
                    if (selectedResult.markerCoords.worldspace !== undefined && selectedResult.markerCoords.worldspace !== currentWs) {
                        const refX = mapState.player.active ? mapState.player.x : 0;
                        const refY = mapState.player.active ? mapState.player.y : 0;
                        const resolved = WorldspaceUtils.resolveGatewayTarget(
                            selectedResult.markerCoords.worldspace,
                            currentWs,
                            targetX,
                            targetY,
                            0,
                            refX,
                            refY,
                            mapState.lastPayload
                        );
                        if (resolved) {
                            targetX = resolved.x;
                            targetY = resolved.y;
                        }
                    }
                    MapViewport.centerOnWorldCoords(targetX, targetY);
                }
            } else {
                MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            }
        } else {
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
        }

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }

        FocusManager.triggerControlsUpdate();
    },
    onItemClick: (result, index) => {
        const container = document.getElementById('search-panel');
        if (!container) return;

        FocusManager.setFocus('SEARCH_PANEL');

        if (index === -2) {
            SearchPanel.collapse();
            return;
        }

        if (index === -1 || searchPanelState.isCollapsed) {
            SearchPanel.expand();
            return;
        }

        listController.setSelectedIndex(index, true, true);
    },
    onItemHover: (result, index) => {
        if ((SearchPanel as any)._ignoreHover) return;
        if (!searchPanelState.isCollapsed) {
            if (searchBox && searchBox.isFocused()) {
                searchBox.blur();
            }
            if (index !== -1 && listController.getSelectedIndex() !== index) {
                listController.setSelectedIndex(index, true, false);
            }
        }
    }
});

export const SearchPanel = {
    getState(): SearchPanelState {
        return searchPanelState;
    },

    isQuestSelected(): boolean {
        if (searchPanelState.isCollapsed) return false;
        const selected = listController.getSelectedItem();
        return selected?.type === 'quest';
    },

    isSelectedQuestCompleted(): boolean {
        if (searchPanelState.isCollapsed) return false;
        const selected = listController.getSelectedItem();
        if (selected?.type === 'quest') {
            return QuestUtils.isQuestCompleted(selected.originalRef);
        }
        return false;
    },

    expand(): void {
        if (!searchPanelState.isCollapsed) return;
        searchPanelState.isCollapsed = false;

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(false);
        }

        FocusManager.setFocus('SEARCH_PANEL');
        this.render();

        if (searchBox) {
            searchBox.focus();
        }
    },

    collapse(): void {
        if (searchBox) {
            searchBox.blur();
        }

        if (searchPanelState.isCollapsed) {
            this.closeCards();
            MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        searchPanelState.isCollapsed = true;
        
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        this.closeCards();
        MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
        
        if (FocusManager.getFocus() === 'SEARCH_PANEL') {
            FocusManager.setFocus('MAP');
        }
        this.render();
    },

    toggleCollapse(): void {
        if (searchPanelState.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    },

    closeCards(): void {
        MarkerCard.close();
        QuestCard.close();
        SettlementCard.close();
        CustomMarkerCard.close();
    },

    openCardForResult(result: SearchResult): void {
        const container = document.getElementById('search-panel');
        if (!container) return;

        const returnFocusId = 'SEARCH_PANEL';
        const onNavBack = () => this.collapse();

        if (result.type === 'marker') {
            const m = result.originalRef;
            MarkerCard.open(m.name, m.formId, m.canFastTravel, undefined, container, searchPanelState.dockCorner, false, returnFocusId, onNavBack);
        } else if (result.type === 'quest') {
            const q = result.originalRef;
            QuestCard.open(q, undefined, container, searchPanelState.dockCorner, false, returnFocusId, onNavBack);
        } else if (result.type === 'workshop') {
            const w = result.originalRef;
            const marker = mapState.lastPayload?.markers.find(m => m.formId === w.markerFormId || m.formId === w.formId || m.formId === w.locationFormId);
            const canFastTravel = marker ? marker.canFastTravel : w.owned;
            const markerFormId = marker ? marker.formId : w.markerFormId;
            SettlementCard.open(w, markerFormId, canFastTravel, undefined, container, searchPanelState.dockCorner, false, returnFocusId, onNavBack);
        }
    },

    init(): void {
        FocusManager.register({
            id: 'SEARCH_PANEL',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', { action: 'NAV_UP', label: 'MOVE' }, { action: 'NAV_DOWN', label: 'MOVE' }, 'PAN_MOUSE'];
                if (searchBox?.isFocused()) {
                    return controls;
                }

                const selected = listController.getSelectedItem();
                if (selected) {
                    if (selected.type === 'quest') {
                        const isCompleted = QuestUtils.isQuestCompleted(selected.originalRef);
                        if (!isCompleted) {
                            controls.push('TOGGLE_ACTIVE');
                            if (QuestUtils.hasActiveTargets(selected.originalRef)) {
                                controls.push({ action: 'CENTER_ITEM', label: 'CENTER OBJECTIVE' });
                            }
                        }
                    } else {
                        controls.push({ action: 'CENTER_ITEM', label: 'CENTER MARKER' });
                    }
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const container = document.getElementById('search-panel');
                if (container) { container.classList.add('focused'); container.classList.add('collapsible-panel'); }
            },
            onFocusLost: (newFocusId?: string) => {
                const container = document.getElementById('search-panel');
                if (container) container.classList.remove('focused');
                
                const cardFocuses = ['MARKER_CARD', 'QUEST_CARD', 'SETTLEMENT_CARD', 'CUSTOM_MARKER_CARD'];
                if (newFocusId && !cardFocuses.includes(newFocusId) && !searchPanelState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        window.addEventListener('click', (e: MouseEvent) => {
            const container = document.getElementById('search-panel');
            const targetNode = e.target as Node;
            
            const clickedInCard = 
                document.getElementById('marker-card-panel')?.contains(targetNode) ||
                document.getElementById('quest-card-panel')?.contains(targetNode) ||
                document.getElementById('settlement-card-panel')?.contains(targetNode) ||
                document.getElementById('custom-marker-card-panel')?.contains(targetNode);
            
            if (container && !container.contains(targetNode) && !clickedInCard) {
                if (!searchPanelState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        this.render();
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (searchPanelState.isCollapsed) {
            if (DockControlsSystem.isExpandKey(e, searchPanelState.dockCorner)) {
                this.expand();
                return true;
            }
            return false;
        }

        const inputIsFocused = searchBox ? searchBox.isFocused() : false;
        const results = this.getVisibleResults();

        if (inputIsFocused) {
            if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
                if (results.length > 0) {
                    searchBox?.blur();
                    EngineBridge.emitSound('UIGeneralFocus');
                    listController.setSelectedIndex(0, true, true);
                }
                return true;
            }
            if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
                e.preventDefault();
                searchBox?.blur();
                EngineBridge.emitSound('UIMenuCancel');
                return true;
            }
            return true;
        }

        if (DockControlsSystem.isCollapseKey(e, searchPanelState.dockCorner)) {
            this.collapse();
            return true;
        }

        const isRightDocked = searchPanelState.dockCorner.includes('right');
        if (isRightDocked ? KeybindsSystem.isAction(e, 'NAV_LEFT') : KeybindsSystem.isAction(e, 'NAV_RIGHT')) {
            const selected = listController.getSelectedItem();
            if (selected) {
                if (selected.type === 'marker' && MarkerCard.isOpen()) FocusManager.setFocus('MARKER_CARD');
                else if (selected.type === 'quest' && QuestCard.isOpen()) FocusManager.setFocus('QUEST_CARD');
                else if (selected.type === 'workshop' && SettlementCard.isOpen()) FocusManager.setFocus('SETTLEMENT_CARD');
                else if (selected.type === 'customMarker' && CustomMarkerCard.isOpen()) FocusManager.setFocus('CUSTOM_MARKER_CARD');
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            if (results.length > 0) {
                listController.navigateNext();
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_UP')) {
            if (results.length > 0) {
                if (listController.getSelectedIndex() <= 0) {
                    if (searchBox) {
                        searchBox.focus();
                        EngineBridge.emitSound('UIGeneralFocus');
                        const el = searchBox.getInputElement();
                        const len = el.value.length;
                        el.setSelectionRange(len, len);
                    }
                } else {
                    listController.navigatePrev();
                }
            } else {
                if (searchBox) {
                    searchBox.focus();
                    EngineBridge.emitSound('UIGeneralFocus');
                    const el = searchBox.getInputElement();
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                }
            }
            return true;
        }
        
        if (KeybindsSystem.isAction(e, 'TOGGLE_ACTIVE')) {
            const selected = listController.getSelectedItem();
            if (selected && selected.type === 'quest') {
                QuestList.toggleQuestActive(selected.originalRef);
            }
            return true;
        }
        
        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            this.collapse();
            return true;
        }



        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            const selected = listController.getSelectedItem();
            if (selected) {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                if (selected.markerCoords) {
                    let targetX = selected.markerCoords.x;
                    let targetY = selected.markerCoords.y;
                    const currentWs = mapState.activeMapConfig?.worldspaceID ?? 0;
                    if (selected.markerCoords.worldspace !== undefined && selected.markerCoords.worldspace !== currentWs) {
                        const refX = mapState.player.active ? mapState.player.x : 0;
                        const refY = mapState.player.active ? mapState.player.y : 0;
                        const resolved = WorldspaceUtils.resolveGatewayTarget(
                            selected.markerCoords.worldspace,
                            currentWs,
                            targetX,
                            targetY,
                            0,
                            refX,
                            refY,
                            mapState.lastPayload
                        );
                        if (resolved) {
                            targetX = resolved.x;
                            targetY = resolved.y;
                        }
                    }
                    MapViewport.centerOnWorldCoords(targetX, targetY);
                } else if (selected.type === 'quest') {
                    const markerId = selected.originalRef.formId ?? selected.originalRef.questName;
                    const markerContainer = document.querySelector(`.marker-container[data-form-id="${markerId}"]`) ||
                                            document.querySelector(`.marker-container[data-display-name="${markerId}"]`);
                    if (markerContainer) {
                        MapViewport.centerOnElement(markerContainer as HTMLElement);
                    }
                }
            }
            return true;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (searchBox) {
                e.preventDefault();
                searchBox.focus(false);
                const el = searchBox.getInputElement();
                el.value = el.value + e.key;
                
                setTimeout(() => {
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }, 10);
                return true;
            }
        }

        return false;
    },

    getVisibleResults(): SearchResult[] {
        if (searchPanelState.isCollapsed) return [];
        return searchPanelState.results;
    },

    mountLayout(container: HTMLElement): void {
        container.classList.add('collapsible-panel');
        container.classList.add('selectable-list');
        container.innerHTML = `
          <div class="cp-header">
             <div class="cp-title">SEARCH</div>
             <div class="cp-collapse-btn">
               <span class="cp-collapse-text">COLLAPSE</span>
               <span class="cp-btn-icon"></span>
            </div>
          </div>
          <div class="sp-search-bar-container tb-sub-header" style="padding: 0 8px 8px 8px; justify-content: stretch; height: 38px;">
          </div>
          <div class="sl-body">
             <div class="sl-items-list"></div>
             <div class="sl-scrollbar">
               <div class="sl-scrollbar-thumb"></div>
            </div>
          </div>
        `;

        collapsiblePanel = new CollapsiblePanel({
            panelElement: container,
            collapseBtnElement: container.querySelector('.cp-collapse-btn') as HTMLElement,
            dockCorner: searchPanelState.dockCorner,
            initiallyCollapsed: searchPanelState.isCollapsed,
            onToggle: (collapsed) => {
                if (collapsed) this.collapse();
                else this.expand();
            }
        });
        
        const searchBarContainer = container.querySelector('.sp-search-bar-container') as HTMLElement;
        if (searchBarContainer) {
            searchBox = new SearchBox({
                container: searchBarContainer,
                placeholder: 'Type to search...',
                initialValue: searchPanelState.searchTerm,
                onInput: (text) => {
                    searchPanelState.searchTerm = text;
                    this.performSearch();
                },
                onFocus: () => {
                    const panelEl = document.getElementById('search-panel');
                    if (panelEl) panelEl.setAttribute('data-input-focused', 'true');
                    if (FocusManager.getFocus() !== 'SEARCH_PANEL') {
                        FocusManager.setFocus('SEARCH_PANEL');
                    }
                    this.closeCards();
                    MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
                    this.updateSelection(false);
                    FocusManager.triggerControlsUpdate();
                },
                onBlur: () => {
                    const panelEl = document.getElementById('search-panel');
                    if (panelEl) panelEl.setAttribute('data-input-focused', 'false');
                    this.updateSelection(false);
                    FocusManager.triggerControlsUpdate();
                }
            });
        }

        isLayoutMounted = true;
    },
    
    performSearch(): void {
        this.closeCards();
        if (!searchPanelState.searchTerm) {
            searchPanelState.results = [];
        } else {
            searchPanelState.results = SearchEngine.search(searchPanelState.searchTerm);
        }
        
        listController.setSelectedIndex(searchPanelState.results.length > 0 ? 0 : -1, false, false);
        this.renderList();
    },

    render(): void {
        const container = document.getElementById('search-panel');
        if (!container) return;

        DockControlsSystem.applyDockPosition(container, searchPanelState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
            if (searchPanelState.searchTerm) {
                this.performSearch();
            }
        }

        const isCollapsed = searchPanelState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? 'EXPAND' : 'COLLAPSE';
        }

        const subHeader = container.querySelector('.tb-sub-header') as HTMLElement;
        if (subHeader) {
            subHeader.style.display = isCollapsed ? 'none' : 'flex';
        }

        if (collapsiblePanel) {
            collapsiblePanel.updateGlyph();
        }
        
        this.renderList();
    },
    
    renderList(): void {
        const container = document.getElementById('search-panel');
        if (!container) return;
        
        const listEl = container.querySelector('.sl-items-list') as HTMLElement;
        if (!listEl) return;

        if (searchPanelState.isCollapsed) {
            return;
        }

        const savedScrollTop = listEl.scrollTop;
        const itemsToRender = this.getVisibleResults();
        let itemsHtml = '';

        if (itemsToRender.length === 0) {
            if (searchPanelState.searchTerm) {
                itemsHtml = `<div class="sl-empty">NO RESULTS FOUND</div>`;
            } else {
                itemsHtml = `<div class="sl-empty">ENTER SEARCH TERM</div>`;
            }
        } else {
            itemsHtml = itemsToRender.map((r, idx) => this.renderResultItem(r, idx)).join('');
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
        if (searchPanelState.isCollapsed) return;
        const container = document.getElementById('search-panel');
        if (!container) return;

        const inputIsFocused = searchBox ? searchBox.isFocused() : false;
        const items = container.querySelectorAll('.sl-item');
        const selectedIdx = inputIsFocused ? -1 : listController.getSelectedIndex();

        items.forEach((item, idx) => {
            if (idx === selectedIdx) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        if (!inputIsFocused) {
            listController.setSelectedIndex(listController.getSelectedIndex(), true, autoScroll);
        }
    },

    renderResultItem(result: SearchResult, index: number): string {
        const isSelected = !searchPanelState.isCollapsed && index === listController.getSelectedIndex();
        const keyAttr = `data-result-id="${result.id}"`;
        
        const titleHtml = SearchUtils.highlightText(result.title, result.titleMatchIndices);
        
        let subtitleHtml = '';
        if (result.subtitle) {
            subtitleHtml = `<div class="sl-item-subtitle" style="font-size: 0.8em; opacity: 0.8;">${SearchUtils.highlightText(result.subtitle, result.subtitleMatchIndices || [])}</div>`;
        } else if (result.markerCoords && result.markerCoords.worldspace !== undefined) {
            let wsString = WorldspaceUtils.getWorldspaceName(result.markerCoords.worldspace) || 'Unknown';
            subtitleHtml = `<div class="sl-item-subtitle" style="font-size: 0.8em; opacity: 0.8;">${StringUtils.escapeHtml(wsString)}</div>`;
        }

        let iconUrl = ThemeEngine.getMarkerIconUrl(result.iconType || 0, true, result.customIcon);
        
        if (result.type === 'quest') {
            const q = result.originalRef;
            let isDoor = false;
            if (q.objectives) {
                const activeObj = q.objectives.find((o: any) => o.state === 1) || q.objectives[0];
                if (activeObj && activeObj.targets && activeObj.targets.length > 0) {
                    isDoor = activeObj.targets[0].isDoor;
                }
            }
            iconUrl = ThemeEngine.getQuestMarkerIconUrl(isDoor, q.isTracked);
        }

        const badgesHtml = result.badgesHtml || '';

        return `
          <div class="sl-item ${isSelected ? 'selected' : ''}" data-quest-index="${index}" ${keyAttr} style="min-height: 44px; display: flex; align-items: center;">
             <div class="sl-item-content" style="padding-left: 5px; display: flex; align-items: center; width: 100%;">
                 <img class="wl-marker-icon" src="${iconUrl}" alt="Icon" style="width: 24px; height: 24px; margin-right: 10px; object-fit: contain;" />
                 <div class="wl-text-container" style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
                     <div class="sl-item-title" style="display: flex; align-items: center; gap: 5px; line-height: 1.2;">
                         ${titleHtml}
                         ${badgesHtml}
                     </div>
                     <div class="wl-subtitle" style="opacity: 0.7; line-height: 1;">${subtitleHtml}</div>
                 </div>
            </div>
          </div>
        `;
    }
};
