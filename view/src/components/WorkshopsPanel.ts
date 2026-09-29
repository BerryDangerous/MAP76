import { EngineBridge } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';
import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { AssetManager } from '@/systems/assetManager.js';
import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager, Corner } from '@/systems/layoutManager.js';
import { SelectableListController } from '@/systems/listController.js';
import { MapViewport } from '@/systems/viewport.js';
import { OverlayManager } from '@/managers/overlayManager.js';

import { SettlementDataWithRatings, getWorkshopIconType, getWorkshopBadgesHtml, getWorkshopSubtitle, calculateSettlementRatings } from '@/utils/settlementUtils.js';
import { StringUtils } from '@/utils/stringUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';
import { POIMarker } from '@/types/markers.js';

import { MarkerCard } from '@/components/MarkerCard.js';
import { SettlementCard } from '@/components/SettlementCard.js';

import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel.js';
import { CustomScrollbar } from '@/components/ui/Scrollbar.js';
import { TabBar } from '@/components/ui/TabBar.js';

export type LocationSortMode = 'ATTENTION' | 'ALPHABETICAL' | 'HAPPINESS' | 'POPULATION';
export type LocationFilterTab = 'ALL' | 'FAVORITES' | 'WORKSHOPS';

export interface LocationsListState {
    currentTab: LocationFilterTab;
    sortMode: LocationSortMode;
    isCollapsed: boolean;
    hoverIndex: number;
    selectedItemKey: string | null;
    dockCorner: Corner;
}

export type LocationListItem = 
    | { type: 'favorite'; marker: POIMarker; key: string; isFavoriteGroup?: boolean }
    | { type: 'workshop'; data: SettlementDataWithRatings; key: string; isFavoriteGroup?: boolean }
    | { type: 'divider'; key: string; label: string; isFavoriteGroup?: boolean };

const locationsListState: LocationsListState = {
    currentTab: 'ALL',
    sortMode: 'ATTENTION',
    isCollapsed: true,
    hoverIndex: -1,
    selectedItemKey: null,
    dockCorner: 'bottom-left'
};

let tabBar = new TabBar<LocationFilterTab>({
    tabs: [
        { id: 'ALL', label: 'ALL' },
        { id: 'FAVORITES', label: 'FAVORITES' },
        { id: 'WORKSHOPS', label: 'WORKSHOPS' }
    ],
    activeTabId: 'ALL',
    onTabChange: (tabId) => {
        LocationsList.setFilterTab(tabId);
    }
});

const listController = new SelectableListController<LocationListItem>({
    getItems: () => LocationsList.getVisibleItems(),
    getItemId: (item) => item.key,
    containerSupplier: () => document.getElementById('locations-list-panel'),
    itemSelector: '.sl-item',
    onSelectionChange: (selectedItem) => {
        if (locationsListState.isCollapsed) return;

        if (selectedItem && selectedItem.type !== 'divider') {
            locationsListState.selectedItemKey = selectedItem.key;
            LocationsList.notifyItemFocused(selectedItem);
            LocationsList.openCardForItem(selectedItem);
        } else {
            locationsListState.selectedItemKey = null;
            LocationsList.closeCards();
        }

        FocusManager.triggerControlsUpdate();

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }
    },
    onItemClick: (item, index) => {
        const container = document.getElementById('locations-list-panel');
        if (!container) return;

        FocusManager.setFocus('WORKSHOP_LIST');

        if (index === -2) {
            LocationsList.collapse();
            return;
        }

        if (index === -1 || locationsListState.isCollapsed) {
            if (item && item.type !== 'divider') {
                locationsListState.selectedItemKey = item.key;
            }
            const panelRect = container.getBoundingClientRect();
            const items = container.querySelectorAll('.sl-item');
            const itemEl = (index >= 0 && items[index]) ? items[index] as HTMLElement : null;
            const itemRect = itemEl ? itemEl.getBoundingClientRect() : panelRect;
            const targetRelativeOffset = panelRect.bottom - itemRect.bottom;

            LocationsList.expand(targetRelativeOffset);
            return;
        }

        if (item && item.type !== 'divider') {
            listController.setSelectedIndex(index, false);
            LocationsList.notifyItemFocused(item);
        }
    },
    onItemHover: (item, index) => {
        if ((LocationsList as any)._ignoreHover) return;
        if (item && item.type === 'divider') return;

        if (locationsListState.isCollapsed) {
            if (locationsListState.hoverIndex !== index) {
                if (index !== -1) EngineBridge.emitSound('UIGeneralFocus');
                locationsListState.hoverIndex = index;
                LocationsList.updateSelection();
            }
        } else {
            if (index !== -1 && listController.getSelectedIndex() !== index) {
                listController.setSelectedIndex(index, true, false);
            }
        }
    }
});

let collapsiblePanel: CollapsiblePanel | null = null;
let customScrollbar: CustomScrollbar | null = null;
let isLayoutMounted = false;

export const LocationsList = {
    getState(): LocationsListState {
        return locationsListState;
    },

    closeCards(): void {
        const container = document.getElementById('locations-list-panel');
        if (container) OverlayManager.dismissCardIfAnchoredTo(container);
    },

    setFilterTab(tab: LocationFilterTab): void {
        locationsListState.currentTab = tab;
        listController.setSelectedIndex(0, false);
        this.render();
        this.updateSelection();
        FocusManager.triggerControlsUpdate();
    },

    expand(targetRelativeOffset: number | null = null): void {
        if (!locationsListState.isCollapsed) return;
        locationsListState.isCollapsed = false;

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(false);
        }

        const expandedItems = this.getVisibleItems();
        let targetIndex = 0;
        if (locationsListState.selectedItemKey !== null) {
            const foundIdx = expandedItems.findIndex(i => i.key === locationsListState.selectedItemKey);
            targetIndex = foundIdx !== -1 ? foundIdx : 0;
        } else {
            const firstSelectable = expandedItems.findIndex(i => i.type !== 'divider');
            if (firstSelectable !== -1) {
                targetIndex = firstSelectable;
                locationsListState.selectedItemKey = expandedItems[firstSelectable].key;
            } else {
                targetIndex = -1;
                locationsListState.selectedItemKey = null;
            }
        }

        listController.setSelectedIndex(targetIndex, false, false);

        FocusManager.setFocus('WORKSHOP_LIST');
        this.render();
        this.updateSelection(false);

        if (targetRelativeOffset !== null && targetIndex !== -1) {
            listController.scrollItemToRelativeOffset(targetIndex, targetRelativeOffset);
        }
    },

    collapse(): void {
        if (locationsListState.isCollapsed) {
            this.closeCards();
            MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        locationsListState.isCollapsed = true;
        locationsListState.hoverIndex = -1;
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        this.closeCards();
        MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
        
        if (FocusManager.getFocus() === 'WORKSHOP_LIST') {
            FocusManager.setFocus('MAP');
        }
        this.render();
    },

    toggleCollapse(): void {
        if (locationsListState.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    },

    init(): void {
        tabBar.updateTabs([
            { id: 'ALL', label: t('locations.tabs.all') },
            { id: 'FAVORITES', label: t('locations.tabs.favorites') },
            { id: 'WORKSHOPS', label: t('locations.tabs.workshops') }
        ]);

        FocusManager.register({
            id: 'WORKSHOP_LIST',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', 'NAV_UP', 'NAV_DOWN', 'PAN_MOUSE'];
                
                if (locationsListState.currentTab === 'WORKSHOPS') {
                    const sortLabel = `${t('controls.actions.sort')} (${t(`locations.sortMode.${locationsListState.sortMode.toLowerCase()}`)})`;
                    controls.push({ action: 'SORT', label: sortLabel });
                }

                controls.push({ action: 'CENTER_ITEM', label: t('markers.controls.centerMarker') });
                controls.push('SELECT');
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const container = document.getElementById('locations-list-panel');
                if (container) { container.classList.add('focused'); container.classList.add('collapsible-panel'); }
            },
            onFocusLost: (newFocusId?: string) => {
                const container = document.getElementById('locations-list-panel');
                if (container) container.classList.remove('focused');
            }
        });

        const container = document.getElementById('locations-list-panel');
        if (container) {
            OverlayManager.registerPanel('WORKSHOP_LIST', container, () => this.collapse());
        }

        window.addEventListener('languageChanged', () => {
            this.reloadLocales();
        });

        this.render();
    },

    reloadLocales(): void {
        const container = document.getElementById('locations-list-panel');
        if (container) {
            tabBar.updateTabs([
                { id: 'ALL', label: t('locations.tabs.all') },
                { id: 'FAVORITES', label: t('locations.tabs.favorites') },
                { id: 'WORKSHOPS', label: t('locations.tabs.workshops') }
            ]);
            this.render();
        }
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (locationsListState.isCollapsed) {
            const config = LayoutManager.getCornerConfig(locationsListState.dockCorner);
            if (KeybindsSystem.isPanelExpandKey(e, config.expandKey)) {
                this.expand();
                return true;
            }
            return false;
        }

        const items = this.getVisibleItems();
        const config = LayoutManager.getCornerConfig(locationsListState.dockCorner);
        if (KeybindsSystem.isPanelCollapseKey(e, config.collapseKey)) {
            this.collapse();
            return true;
        }

        const isRightDocked = locationsListState.dockCorner.includes('right');
        if (KeybindsSystem.isAction(e, 'SELECT') || (isRightDocked ? KeybindsSystem.isAction(e, 'NAV_LEFT') : KeybindsSystem.isAction(e, 'NAV_RIGHT'))) {
            if (SettlementCard.isOpen()) {
                FocusManager.setFocus('SETTLEMENT_CARD');
                EngineBridge.emitSound('UIGeneralFocus');
            } else if (MarkerCard.isOpen()) {
                FocusManager.setFocus('MARKER_CARD');
                EngineBridge.emitSound('UIGeneralFocus');
            }
            return true;
        }

        if (tabBar.handleKeyDown(e)) {
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            if (items.length > 0) {
                listController.navigateNext();
                const selected = listController.getSelectedItem();
                if (selected && selected.type === 'divider') {
                    listController.navigateNext();
                }
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_UP')) {
            if (items.length > 0) {
                listController.navigatePrev();
                const selected = listController.getSelectedItem();
                if (selected && selected.type === 'divider') {
                    listController.navigatePrev();
                }
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'SORT') && locationsListState.currentTab === 'WORKSHOPS') {
            const modes: LocationSortMode[] = ['ATTENTION', 'ALPHABETICAL', 'HAPPINESS', 'POPULATION'];
            const nextIdx = (modes.indexOf(locationsListState.sortMode) + 1) % modes.length;
            locationsListState.sortMode = modes[nextIdx];
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
            if (selected && selected.type !== 'divider') {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                let formId: number | undefined;
                if (selected.type === 'favorite') formId = selected.marker.formId;
                else if (selected.type === 'workshop') formId = selected.data.markerFormId;

                if (formId !== undefined) {
                    const marker = mapState.lastPayload?.markers?.find(m => m.formId === formId);
                    if (marker) {
                        MapViewport.centerOnTarget(marker.worldspace, marker.x, marker.y, 0);
                    }
                }
            }
            return true;
        }

        return false;
    },

    notifyItemFocused(item: LocationListItem | null): void {
        if (!item || item.type === 'divider') {
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }
        
        let formId: number | undefined;
        if (item.type === 'favorite') formId = item.marker.formId;
        else if (item.type === 'workshop') formId = item.data.markerFormId;

        if (formId !== undefined) {
            const marker = mapState.lastPayload?.markers?.find(m => m.formId === formId);
            if (marker && appSettings.focusMarkerOnSelection) {
                if (!MapViewport.centerOnTarget(marker.worldspace, marker.x, marker.y, 0)) {
                    MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
                }
            } else {
                MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            }
        }
    },

    openCardForItem(item: LocationListItem): void {
        if (item.type === 'divider') return;

        const container = document.getElementById('locations-list-panel') || undefined;
        const returnFocusId = 'WORKSHOP_LIST';
        const onNavBack = () => this.collapse();

        if (item.type === 'favorite') {
            const marker = item.marker;
            SettlementCard.close();
            MarkerCard.open(marker.name, marker.formId, marker.canFastTravel, undefined, container, locationsListState.dockCorner, false, returnFocusId, onNavBack);
        } else if (item.type === 'workshop') {
            const workshop = item.data;
            const marker = mapState.lastPayload?.markers?.find(m => m.formId === workshop.markerFormId);
            const canFastTravel = marker ? marker.canFastTravel : workshop.owned;

            if (workshop.vassal) {
                SettlementCard.close();
                MarkerCard.open(workshop.name, workshop.markerFormId, canFastTravel, undefined, container, locationsListState.dockCorner, false, returnFocusId, onNavBack);
            } else {
                MarkerCard.close();
                SettlementCard.open(workshop, workshop.markerFormId, canFastTravel, undefined, container, locationsListState.dockCorner, false, returnFocusId, onNavBack);
            }
        }
    },

    sortWorkshops(workshops: SettlementDataWithRatings[], sortMode: LocationSortMode): SettlementDataWithRatings[] {
        let sorted = [...workshops];
        if (sortMode === 'ALPHABETICAL') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortMode === 'HAPPINESS') {
            sorted.sort((a, b) => {
                const diff = (a.happiness || 0) - (b.happiness || 0);
                return diff !== 0 ? diff : a.name.localeCompare(b.name);
            });
        } else if (sortMode === 'POPULATION') {
            sorted.sort((a, b) => {
                const diff = (b.population || 0) - (a.population || 0);
                return diff !== 0 ? diff : a.name.localeCompare(b.name);
            });
        } else if (sortMode === 'ATTENTION') {
            sorted.sort((a, b) => {
                const ratingA = calculateSettlementRatings(a).overallStatus;
                const ratingB = calculateSettlementRatings(b).overallStatus;
                const diff = ratingA - ratingB;
                return diff !== 0 ? diff : a.name.localeCompare(b.name);
            });
        }
        return sorted;
    },

    getVisibleItems(): LocationListItem[] {
        const items: LocationListItem[] = [];
        const payload = mapState.lastPayload;
        if (!payload) return items;

        const favIds = payload.favoriteLocations || [];
        const allMarkers = payload.markers || [];
        const workshops = payload.settlements || [];

        const favMarkers = allMarkers.filter(m => favIds.includes(m.formId));
        favMarkers.sort((a, b) => a.name.localeCompare(b.name));

        const activeWorkshops = workshops.filter(s => s.owned || s.vassal);
        const sortedWorkshops = this.sortWorkshops(activeWorkshops, locationsListState.sortMode);
        const azWorkshops = this.sortWorkshops(activeWorkshops, 'ALPHABETICAL');

        const createFavItem = (m: POIMarker): LocationListItem => {
            const workshop = activeWorkshops.find(s => s.markerFormId === m.formId);
            if (workshop) {
                return { type: 'workshop', data: workshop, key: `fav_set_${workshop.formId}`, isFavoriteGroup: true };
            }
            return { type: 'favorite', marker: m, key: `fav_${m.formId}`, isFavoriteGroup: true };
        };
        const createWorkshopItem = (s: SettlementDataWithRatings): LocationListItem => ({ type: 'workshop', data: s, key: `set_${s.formId}`, isFavoriteGroup: false });

        if (locationsListState.currentTab === 'FAVORITES') {
            return favMarkers.map(createFavItem);
        } else if (locationsListState.currentTab === 'WORKSHOPS') {
            return sortedWorkshops.map(createWorkshopItem);
        } else {
            const result: LocationListItem[] = [];
            if (favMarkers.length > 0) {
                result.push(...favMarkers.map(createFavItem));
            }
            const nonFavWorkshops = azWorkshops.filter(s => !favIds.includes(s.markerFormId));
            if (nonFavWorkshops.length > 0) {
                result.push(...nonFavWorkshops.map(createWorkshopItem));
            }
            return result;
        }
    },

    mountLayout(container: HTMLElement): void {
        container.classList.add('collapsible-panel');
        container.classList.add('selectable-list');
        container.classList.add('workshop-list');
        container.innerHTML = `
          <div class="cp-header">
             <div class="cp-title">${t('locations.title')}</div>
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
            dockCorner: locationsListState.dockCorner,
            initiallyCollapsed: locationsListState.isCollapsed,
            onToggle: (collapsed) => {
                if (collapsed) this.collapse();
                else this.expand();
            }
        });

        isLayoutMounted = true;
    },

    render(): void {
        const container = document.getElementById('locations-list-panel');
        if (!container) return;

        LayoutManager.anchorToCorner(container, locationsListState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
        }

        const isCollapsed = locationsListState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));

        const titleEl = container.querySelector('.cp-title');
        if (titleEl) {
            if (isCollapsed && locationsListState.currentTab !== 'ALL') {
                const tabLabel = t(`locations.tabs.${locationsListState.currentTab.toLowerCase()}`);
                titleEl.textContent = `${t('locations.title')} - ${tabLabel}`;
            } else {
                titleEl.textContent = t('locations.title');
            }
        }

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? t('controls.expand') : t('controls.collapse');
        }

        if (collapsiblePanel) {
            collapsiblePanel.updateGlyph();
        }

        const listEl = container.querySelector('.sl-items-list') as HTMLElement;
        if (!listEl) return;

        const savedScrollTop = listEl.scrollTop;
        const itemsToRender = this.getVisibleItems();
        let itemsHtml = '';

        if (itemsToRender.length === 0) {
            const emptyKey = locationsListState.currentTab === 'FAVORITES' ? 'locations.empty.favorites'
                : locationsListState.currentTab === 'WORKSHOPS' ? 'locations.empty.workshops'
                : 'locations.empty.all';
            itemsHtml = `<div class="sl-empty">${t(emptyKey)}</div>`;
        } else {
            let currentItemIndex = 0;
            const renderItem = (item: LocationListItem) => {
                if (item.type === 'favorite') {
                    return this.renderFavoriteItem(item.marker, currentItemIndex++, item.key);
                } else if (item.type === 'workshop') {
                    return this.renderWorkshopItem(item.data, currentItemIndex++, item.key);
                }
                return '';
            };

            if (locationsListState.currentTab === 'ALL') {
                const topItems = itemsToRender.filter(i => i.isFavoriteGroup);
                const bottomItems = itemsToRender.filter(i => !i.isFavoriteGroup);
                
                itemsHtml += topItems.map(renderItem).join('');
                if (topItems.length > 0 && bottomItems.length > 0) {
                    itemsHtml += `<div class="sl-separator"></div>`;
                }
                itemsHtml += bottomItems.map(renderItem).join('');
            } else {
                itemsHtml += itemsToRender.map(renderItem).join('');
            }
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
        const container = document.getElementById('locations-list-panel');
        if (!container) return;

        if (locationsListState.isCollapsed) {
            const items = container.querySelectorAll('.sl-item');
            items.forEach((item, idx) => {
                if (idx === locationsListState.hoverIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            LocationsList.closeCards();
            if (customScrollbar) {
                customScrollbar.updateThumbPosition();
            }
            return;
        }

        listController.setSelectedIndex(listController.getSelectedIndex(), true, autoScroll);
    },

    renderFavoriteItem(marker: POIMarker, index: number, keyAttr: string): string {
        const isSelected = !locationsListState.isCollapsed && index === listController.getSelectedIndex();
        const markerIconSvg = AssetManager.getLocationIconSvg(marker.type, (marker.discovered || marker.canFastTravel), marker.customIcon);

        let worldspaceName = '';
        if (marker.worldspace !== undefined) {
            worldspaceName = WorldspaceUtils.getWorldspaceName(marker.worldspace) || 'Unknown';
        }
        const subtitle = worldspaceName ? `${t('search.resultType.location', { defaultValue: 'Location' })} - ${worldspaceName}` : t('search.resultType.location', { defaultValue: 'Location' });

        return `
          <div class="sl-item ${isSelected ? 'selected' : ''}" data-workshop-index="${index}" data-key="${keyAttr}" style="min-height: 44px; display: flex; align-items: center;">
             <div class="sl-item-content wl-item-content" style="padding-left: 5px; display: flex; align-items: center; width: 100%;">
                 <span class="wl-marker-icon icon-wrapper" style="width: 24px; height: 24px; display: inline-block; margin-right: 10px;">${markerIconSvg}</span>
                 <div class="wl-text-container" style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
                     <div class="sl-item-title" style="display: flex; align-items: center; gap: 5px; line-height: 1.2;">
                         ${StringUtils.escapeHtml(marker.name)}
                     </div>
                     <div class="wl-subtitle" style="font-size: 0.8em; opacity: 0.7; line-height: 1;">${StringUtils.escapeHtml(subtitle)}</div>
                 </div>
            </div>
          </div>
        `;
    },

    renderWorkshopItem(workshop: SettlementDataWithRatings, index: number, keyAttr: string): string {
        const isSelected = !locationsListState.isCollapsed && index === listController.getSelectedIndex();
        const baseSubtitle = getWorkshopSubtitle(workshop);
        const marker = mapState.lastPayload?.markers?.find(m => m.formId === workshop.markerFormId);
        const iconType = getWorkshopIconType(workshop, marker);
        const customIcon = marker ? marker.customIcon : undefined;
        const markerIconSvg = AssetManager.getLocationIconSvg(iconType, true, customIcon);
        const badgesHtml = getWorkshopBadgesHtml(workshop);

        let worldspaceName = '';
        if (marker && marker.worldspace !== undefined) {
            worldspaceName = WorldspaceUtils.getWorldspaceName(marker.worldspace) || 'Unknown';
        }
        const fullSubtitle = worldspaceName ? `${baseSubtitle} - ${worldspaceName}` : baseSubtitle;

        return `
          <div class="sl-item ${isSelected ? 'selected' : ''}" data-workshop-index="${index}" data-key="${keyAttr}" style="min-height: 44px; display: flex; align-items: center;">
             <div class="sl-item-content wl-item-content" style="padding-left: 5px; display: flex; align-items: center; width: 100%;">
                 <span class="wl-marker-icon icon-wrapper" style="width: 24px; height: 24px; display: inline-block; margin-right: 10px;">${markerIconSvg}</span>
                 <div class="wl-text-container" style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
                     <div class="sl-item-title" style="display: flex; align-items: center; gap: 5px; line-height: 1.2;">
                         ${StringUtils.escapeHtml(workshop.name)}
                         ${badgesHtml}
                     </div>
                     <div class="wl-subtitle" style="font-size: 0.8em; opacity: 0.7; line-height: 1;">${StringUtils.escapeHtml(fullSubtitle)}</div>
                 </div>
            </div>
          </div>
        `;
    }
};
