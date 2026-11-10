import { SearchResult } from '@/overlays/domain/types.js';
import { t } from '@/core/i18n.js';

import { ASSET_ICON_POWER_ARMOR, ASSET_ICON_CUSTOM_MARKER } from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';
import { getWorldspaceName } from '@/core/state/worldspaces.js';
import { FocusOwner, InputReceiver, InputRouter, KeyAction, KeybindsSystem, type ControlActionHint } from '@/input/index.js';

import { AssetManager } from '@/systems/assetManager.js';
import { anchorToCorner, getCornerConfig, Corner } from '@/overlays/positioning.js';
import { SelectableListController } from '@/systems/listController.js';
import { SoundService } from '@/services/soundService.js';

import { mapSurface } from '@/map/index.js';

import { QuestList, QuestUtils } from '@/overlays/index.js';
import { StringUtils } from '@/utils/stringUtils.js';

import { searchEntities } from '@/overlays/domain/searchEngine.js';
import { SearchUtils } from '@/overlays/domain/searchUtils.js';

import { CollapsiblePanel, CustomScrollbar, SearchBox } from '@/ui/index.js';

export interface SearchPanelState {
    isCollapsed: boolean;
    dockCorner: Corner;
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

        if (selectedResult) {
            SearchPanel.onSelectionChange?.(selectedResult);
            if (selectedResult.markerCoords) {
                if (appSettings.focusMarkerOnSelection) {
                    mapSurface.centerOnTarget(
                        selectedResult.markerCoords.worldspace ?? domainState.getActiveWorldspaceID(),
                        selectedResult.markerCoords.x,
                        selectedResult.markerCoords.y,
                        0
                    );
                }
            } else {
                mapSurface.clearSavedViewport(appSettings.focusMarkerOnSelection);
            }
        } else {
            SearchPanel.onSelectionChange?.(null);
            SearchPanel.closeCards();
            mapSurface.clearSavedViewport(appSettings.focusMarkerOnSelection);
        }

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }

        InputRouter.notifyActionsChanged();
    },
    onItemClick: (result, index) => {
        const container = document.getElementById('search-panel');
        if (!container) return;

        InputRouter.push(FocusOwner.SEARCH_PANEL);

        if (index === -2) {
            SearchPanel.collapse();
            return;
        }

        if (index === -1 || searchPanelState.isCollapsed) {
            SearchPanel.expand();
            return;
        }

        listController.setSelectedIndex(index, true, true);
        SearchPanel.onFlushScheduledCard?.();
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
    onExpanded: null as (() => void) | null,
    onSelectionChange: null as ((result: SearchResult | null) => void) | null,
    onNavigateToDockedCard: null as (() => boolean) | null,
    onRequestCloseCards: null as (() => void) | null,
    onFlushScheduledCard: null as (() => void) | null,

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

        this.onExpanded?.();

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(false);
        }

        InputRouter.push(FocusOwner.SEARCH_PANEL);
        this.render();

        if (searchBox) {
            searchBox.focus();
        }
    },

    collapse(): void {
        if (searchBox) {
            searchBox.blur();
        }
        
        if (window.PrismaOSK && window.PrismaOSK.isOpen()) {
            window.PrismaOSK.close();
        }

        if (searchPanelState.isCollapsed) {
            this.closeCards();
            mapSurface.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        searchPanelState.isCollapsed = true;
        
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        this.closeCards();
        mapSurface.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
        
        InputRouter.remove(FocusOwner.SEARCH_PANEL);

        const container = document.getElementById('search-panel');
        if (container) {
            container.classList.remove('focused');
            container.classList.remove('dimmed');
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
        this.onRequestCloseCards?.();
    },

    id: FocusOwner.SEARCH_PANEL,

    handleAction(action: KeyAction): boolean {
        if (searchPanelState.isCollapsed) return false;

        const inputIsFocused = searchBox ? searchBox.isFocused() : false;
        const results = this.getVisibleResults();
        const isRightDocked = searchPanelState.dockCorner.includes('right');

        if (inputIsFocused) {
            if (KeybindsSystem.isControllerActive && window.PrismaOSK && window.PrismaOSK.isOpen()) {
                if (action === KeyAction.RESET_DEFAULTS) {
                    if (searchBox) searchBox.clear();
                    SoundService.playCancel();
                }
                return true;
            }
            if (action === KeyAction.NAV_DOWN) {
                if (results.length > 0) {
                    searchBox?.blur();
                    SoundService.playFocus();
                    listController.setSelectedIndex(0, true, true);
                }
                return true;
            }
            if (action === KeyAction.NAV_BACK) {
                searchBox?.blur();
                if (results.length > 0) {
                    SoundService.playFocus();
                    listController.setSelectedIndex(0, true, true);
                } else {
                    SoundService.playNavBack();
                }
                return true;
            }
            return true;
        }

        switch (action) {
            case KeyAction.NAV_BACK:
            case KeyAction.COLLAPSE:
                this.collapse();
                SoundService.playFocus();
                return true;

            case KeyAction.NAV_LEFT:
                if (isRightDocked && this.onNavigateToDockedCard?.()) {
                    return true;
                } else {
                    this.collapse();
                    SoundService.playFocus();
                    return true;
                }

            case KeyAction.NAV_RIGHT:
                if (!isRightDocked && this.onNavigateToDockedCard?.()) {
                    return true;
                } else {
                    this.collapse();
                    SoundService.playFocus();
                    return true;
                }

            case KeyAction.NAV_DOWN:
                if (results.length > 0) {
                    listController.navigateNext();
                }
                return true;

            case KeyAction.NAV_UP:
                if (results.length > 0) {
                    if (listController.getSelectedIndex() <= 0) {
                        if (searchBox) {
                            searchBox.focus();
                            SoundService.playFocus();
                            const el = searchBox.getInputElement();
                            const len = el.value.length;
                            el.setSelectionRange(len, len);
                        }
                    } else {
                        listController.navigatePrev();
                    }
                }
                return true;

            case KeyAction.TOGGLE_ACTIVE: {
                const selected = listController.getSelectedItem();
                if (selected && selected.type === 'quest') {
                    QuestList.toggleQuestActive(selected.originalRef);
                    this.performSearch();
                }
                return true;
            }

            case KeyAction.SELECT:
                this.focusDockedCard();
                return true;

            case KeyAction.CENTER_ITEM: {
                const selected = listController.getSelectedItem();
                if (selected) {
                    SoundService.playShowOnMap();
                    if (selected.markerCoords) {
                        mapSurface.centerOnTarget(
                            selected.markerCoords.worldspace ?? domainState.getActiveWorldspaceID(),
                            selected.markerCoords.x,
                            selected.markerCoords.y,
                            selected.markerCoords.z ?? 0
                        );
                    } else if (selected.type === 'quest') {
                        const markerId = selected.originalRef.formId ?? selected.originalRef.questName;
                        const markerContainer = document.querySelector(`.marker-container[data-form-id="${markerId}"]`) ||
                                                document.querySelector(`.marker-container[data-display-name="${markerId}"]`);
                        if (markerContainer) {
                            mapSurface.centerOnElement(markerContainer as HTMLElement);
                        }
                    }
                }
                return true;
            }

            default:
                return false;
        }
    },

    focusDockedCard(): void {
        this.onNavigateToDockedCard?.();
    },

    getAvailableControls(): ControlActionHint[] {
        const controls: ControlActionHint[] = [KeyAction.NAV_BACK, KeyAction.NAV_UP, KeyAction.NAV_DOWN, KeyAction.PAN_MOUSE];
        if (searchBox?.isFocused()) {
            if (KeybindsSystem.isControllerActive && window.PrismaOSK && window.PrismaOSK.isOpen()) {
                controls.push({ action: KeyAction.CHANGE_LAYOUT, label: t('controls.actions.layout', { defaultValue: 'Layouts' }) });
                controls.push({ action: KeyAction.RESET_DEFAULTS, label: t('search.clear', { defaultValue: 'Clear' }) });
            }
            return controls;
        }

        const selected = listController.getSelectedItem();
        if (selected) {
            if (selected.type === 'quest') {
                const isCompleted = QuestUtils.isQuestCompleted(selected.originalRef);
                if (!isCompleted) {
                    controls.push(KeyAction.TOGGLE_ACTIVE);
                    if (QuestUtils.hasActiveTargets(selected.originalRef)) {
                        controls.push(KeyAction.CENTER_ITEM);
                    }
                }
            } else {
                controls.push({ action: KeyAction.CENTER_ITEM, label: t('markers.controls.centerMarker') });
            }
        }
        controls.push(KeyAction.SELECT);
        return controls;
    },

    onFocusGained(): void {
        const container = document.getElementById('search-panel');
        if (container) {
            container.classList.add('focused');
            container.classList.add('collapsible-panel');
        }
    },

    onFocusLost(): void {
        const container = document.getElementById('search-panel');
        if (container) container.classList.remove('focused');
    },

    init(): void {
        InputRouter.register(this);

        window.addEventListener('languageChanged', () => {
            this.reloadLocales();
        });

        this.render();
    },

    reloadLocales(): void {
        const container = document.getElementById('search-panel');
        if (container) {
            this.render();
        }
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
             <div class="cp-title">${t('search.title')}</div>
             <div class="cp-collapse-btn">
               <span class="cp-collapse-text">${t('controls.collapse')}</span>
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
                placeholder: t('search.placeholder'),
                initialValue: searchPanelState.searchTerm,
                onInput: (text) => {
                    searchPanelState.searchTerm = text;
                    this.performSearch();
                },
                onFocus: () => {
                    const panelEl = document.getElementById('search-panel');
                    if (panelEl) panelEl.setAttribute('data-input-focused', 'true');
                    if (InputRouter.getFocus() !== FocusOwner.SEARCH_PANEL) {
                        InputRouter.push(FocusOwner.SEARCH_PANEL);
                    }
                    this.closeCards();
                    mapSurface.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
                    this.updateSelection(false);
                    InputRouter.notifyActionsChanged();
                },
                onBlur: () => {
                    const panelEl = document.getElementById('search-panel');
                    if (panelEl) panelEl.setAttribute('data-input-focused', 'false');
                    this.updateSelection(false);
                    InputRouter.notifyActionsChanged();
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
            searchPanelState.results = searchEntities(searchPanelState.searchTerm);
        }
        
        listController.setSelectedIndex(searchPanelState.results.length > 0 ? 0 : -1, false, false);
        this.renderList();
    },

    render(): void {
        const container = document.getElementById('search-panel');
        if (!container) return;

        anchorToCorner(container, searchPanelState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
            if (searchPanelState.searchTerm) {
                this.performSearch();
            }
        }

        const isCollapsed = searchPanelState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));

        const titleEl = container.querySelector('.cp-title');
        if (titleEl) {
            titleEl.textContent = t('search.title');
        }
        
        if (searchBox) {
            const inputEl = searchBox.getInputElement();
            if (inputEl) inputEl.placeholder = t('search.placeholder');
            const clearBtn = container.querySelector('.search-box-clear-btn');
            if (clearBtn) clearBtn.textContent = t('search.clear', { defaultValue: 'CLEAR' });
        }

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? t('controls.expand') : t('controls.collapse');
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
                itemsHtml = `<div class="sl-empty">${t('search.noResults')}</div>`;
            } else {
                itemsHtml = `<div class="sl-empty">${t('search.empty')}</div>`;
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
            let wsString = getWorldspaceName(result.markerCoords.worldspace) || 'Unknown';
            subtitleHtml = `<div class="sl-item-subtitle" style="font-size: 0.8em; opacity: 0.8;">${StringUtils.escapeHtml(wsString)}</div>`;
        }

        let iconSvg = '';
        if (result.type === 'powerArmor') {
            iconSvg = AssetManager.getIconSvg(ASSET_ICON_POWER_ARMOR);
        } else if (result.type === 'customMarker') {
            iconSvg = AssetManager.getIconSvg(ASSET_ICON_CUSTOM_MARKER);
        } else if (result.type === 'quest') {
            const q = result.originalRef;
            let isDoor = false;
            if (q.objectives) {
                const activeObj = q.objectives.find((o: any) => o.state === 1) || q.objectives[0];
                if (activeObj && activeObj.targets && activeObj.targets.length > 0) {
                    isDoor = activeObj.targets[0].isDoor;
                }
            }
            iconSvg = AssetManager.getQuestMarkerIconSvg(isDoor, q.isTracked);
        } else {
            const isDiscovered = result.discovered !== false;
            iconSvg = AssetManager.getLocationIconSvg(result.iconType || 0, isDiscovered, result.customIcon);
        }

        const badgesHtml = result.badgesHtml || '';

        return `
          <div class="sl-item ${isSelected ? 'selected' : ''}" data-quest-index="${index}" ${keyAttr} style="min-height: 44px; display: flex; align-items: center;">
             <div class="sl-item-content" style="padding-left: 5px; display: flex; align-items: center; width: 100%;">
                 <span class="wl-marker-icon icon-wrapper" style="width: 24px; height: 24px; display: inline-block; margin-right: 10px;">${iconSvg}</span>
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
