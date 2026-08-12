import { mapState } from '../core/state.js';
import { FocusManager } from '../systems/focusManager.js';
import { MapViewport } from './viewport.js';
import { appSettings } from '../core/settings.js';
import { SelectableListController } from '../ui/selectableListController.js';
import { CollapsiblePanel } from '../ui/collapsiblePanel.js';
import { CustomScrollbar } from '../ui/customScrollbar.js';
import { KeybindsSystem } from '../systems/keybinds.js';
import { DockControlsSystem, DockCorner } from '../systems/dockControls.js';
import { SettlementDataWithRatings, getWorkshopIconType, getWorkshopBadgesHtml, getWorkshopSubtitle } from '../utils/settlementUtils.js';
import { SettlementCard } from './settlementCard.js';
import { MarkerCard } from './markerCard.js';
import { ThemeEngine } from '../systems/theme.js';
import { StringUtils } from '../utils/stringUtils.js';
import { WorldspaceUtils } from '../utils/worldspaceUtils.js';

export interface WorkshopListState {
    isCollapsed: boolean;
    hoverIndex: number;
    selectedMarkerFormId: number | null;
    dockCorner: DockCorner;
}

const workshopListState: WorkshopListState = {
    isCollapsed: true,
    hoverIndex: -1,
    selectedMarkerFormId: null,
    dockCorner: 'bottom-left'
};

const listController = new SelectableListController<SettlementDataWithRatings>({
    getItems: () => WorkshopList.getVisibleWorkshops(),
    getItemId: (settlement) => settlement.markerFormId,
    containerSupplier: () => document.getElementById('workshop-list-panel'),
    itemSelector: '.sl-item',
    onSelectionChange: (selectedWorkshop) => {
        if (workshopListState.isCollapsed) return;

        if (selectedWorkshop) {
            workshopListState.selectedMarkerFormId = selectedWorkshop.markerFormId;
            WorkshopList.notifyWorkshopFocused(selectedWorkshop);
            WorkshopList.openCardForWorkshop(selectedWorkshop);
        } else {
            workshopListState.selectedMarkerFormId = null;
            SettlementCard.close();
            MarkerCard.close();
        }

        FocusManager.triggerControlsUpdate();

        if (customScrollbar) {
            customScrollbar.updateThumbPosition();
        }
    },
    onItemClick: (workshop, index) => {
        const container = document.getElementById('workshop-list-panel');
        if (!container) return;

        FocusManager.setFocus('WORKSHOP_LIST');

        if (index === -2) {
            WorkshopList.collapse();
            return;
        }

        if (index === -1 || workshopListState.isCollapsed) {
            if (workshop) {
                workshopListState.selectedMarkerFormId = workshop.markerFormId;
            }
            const panelRect = container.getBoundingClientRect();
            const items = container.querySelectorAll('.sl-item');
            const itemEl = (index >= 0 && items[index]) ? items[index] as HTMLElement : null;
            const itemRect = itemEl ? itemEl.getBoundingClientRect() : panelRect;
            const targetRelativeOffset = panelRect.bottom - itemRect.bottom;

            WorkshopList.expand(targetRelativeOffset);
            return;
        }

        listController.setSelectedIndex(index, false);
        if (workshop) {
            WorkshopList.notifyWorkshopFocused(workshop);
        }
    },
    onItemHover: (workshop, index) => {
        if ((WorkshopList as any)._ignoreHover) return;
        if (workshopListState.isCollapsed) {
            if (workshopListState.hoverIndex !== index) {
                workshopListState.hoverIndex = index;
                WorkshopList.updateSelection();
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

export const WorkshopList = {
    getState(): WorkshopListState {
        return workshopListState;
    },

    expand(targetRelativeOffset: number | null = null): void {
        if (!workshopListState.isCollapsed) return;
        workshopListState.isCollapsed = false;

        (this as any)._ignoreHover = true;
        setTimeout(() => { (this as any)._ignoreHover = false; }, 200);

        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(false);
        }

        const expandedWorkshops = this.getVisibleWorkshops();
        let targetIndex = 0;
        if (workshopListState.selectedMarkerFormId !== null) {
            const foundIdx = expandedWorkshops.findIndex(w => w.markerFormId === workshopListState.selectedMarkerFormId);
            targetIndex = foundIdx !== -1 ? foundIdx : 0;
        } else if (expandedWorkshops.length > 0) {
            targetIndex = 0;
            workshopListState.selectedMarkerFormId = expandedWorkshops[0].markerFormId;
        } else {
            targetIndex = -1;
            workshopListState.selectedMarkerFormId = null;
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
        if (workshopListState.isCollapsed) {
            SettlementCard.close();
            MarkerCard.close();
            MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
            return;
        }
        workshopListState.isCollapsed = true;
        workshopListState.hoverIndex = -1;
        if (collapsiblePanel) {
            collapsiblePanel.setCollapsed(true);
        }

        SettlementCard.close();
        MarkerCard.close();
        MapViewport.clearSavedViewport(appSettings.resetViewportOnPanelCollapse);
        
        if (FocusManager.getFocus() === 'WORKSHOP_LIST') {
            FocusManager.setFocus('MAP');
        }
        this.render();
    },

    toggleCollapse(): void {
        if (workshopListState.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    },

    init(): void {
        FocusManager.register({
            id: 'WORKSHOP_LIST',
            getAvailableControls: () => {
                const controls: import('../systems/focusManager.js').ControlActionDef[] = ['NAV_BACK', { action: 'NAV_UP', label: 'MOVE' }, { action: 'NAV_DOWN', label: 'MOVE' }, 'PAN_MOUSE'];
                const selected = listController.getSelectedItem();
                if (selected && selected.worldspace !== undefined && WorldspaceUtils.isSameWorldspace(selected.worldspace, mapState.activeMapConfig.worldspaceID)) {
                    controls.push({ action: 'CENTER_ITEM', label: 'CENTER MARKER' });
                }
                return controls;
            },
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const container = document.getElementById('workshop-list-panel');
                if (container) { container.classList.add('focused'); container.classList.add('collapsible-panel'); }
            },
            onFocusLost: (newFocusId?: string) => {
                const container = document.getElementById('workshop-list-panel');
                if (container) container.classList.remove('focused');
                if (newFocusId !== 'SETTLEMENT_CARD' && newFocusId !== 'MARKER_CARD' && !workshopListState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        window.addEventListener('click', (e: MouseEvent) => {
            const container = document.getElementById('workshop-list-panel');
            const settlementCard = document.getElementById('settlement-card-panel');
            const markerCard = document.getElementById('marker-card-panel');
            const targetNode = e.target as Node;
            
            if (container && !container.contains(targetNode) && 
                (!settlementCard || !settlementCard.contains(targetNode)) && 
                (!markerCard || !markerCard.contains(targetNode))) {
                if (!workshopListState.isCollapsed) {
                    this.collapse();
                }
            }
        });

        this.render();
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (workshopListState.isCollapsed) {
            if (DockControlsSystem.isExpandKey(e, workshopListState.dockCorner)) {
                this.expand();
                return true;
            }
            return false;
        }

        const workshops = this.getVisibleWorkshops();

        if (DockControlsSystem.isCollapseKey(e, workshopListState.dockCorner)) {
            this.collapse();
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_RIGHT')) {
            if (SettlementCard.isOpen()) {
                FocusManager.setFocus('SETTLEMENT_CARD');
            } else if (MarkerCard.isOpen()) {
                FocusManager.setFocus('MARKER_CARD');
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            if (workshops.length > 0) {
                listController.navigateNext();
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_UP')) {
            if (workshops.length > 0) {
                listController.navigatePrev();
            }
            return true;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            this.collapse();
            return true;
        }



        if (KeybindsSystem.isAction(e, 'CENTER_ITEM')) {
            const selected = listController.getSelectedItem();
            if (selected && selected.markerFormId !== undefined) {
                const marker = mapState.lastPayload?.markers?.find(m => m.formId === selected.markerFormId);
                if (marker) {
                    MapViewport.centerOnWorldCoords(marker.x, marker.y);
                }
            }
            return true;
        }

        return false;
    },

    notifyWorkshopFocused(workshop: SettlementDataWithRatings | null): void {
        if (!workshop || workshop.markerFormId === undefined) {
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
            return;
        }
        
        const marker = mapState.lastPayload?.markers?.find(m => m.formId === workshop.markerFormId);
        if (marker && appSettings.focusMarkerOnSelection) {
            MapViewport.centerOnWorldCoords(marker.x, marker.y);
        } else {
            MapViewport.clearSavedViewport(appSettings.focusMarkerOnSelection);
        }
    },

    openCardForWorkshop(workshop: SettlementDataWithRatings): void {
        const marker = mapState.lastPayload?.markers?.find(m => m.formId === workshop.markerFormId);
        const canFastTravel = marker ? marker.canFastTravel : workshop.owned;
        const container = document.getElementById('workshop-list-panel') || undefined;

        const returnFocusId = 'WORKSHOP_LIST';
        const onNavBack = () => this.collapse();

        if (workshop.vassal) {
            SettlementCard.close();
            MarkerCard.open(workshop.name, workshop.markerFormId, canFastTravel, undefined, container, workshopListState.dockCorner, false, returnFocusId, onNavBack);
        } else {
            MarkerCard.close();
            SettlementCard.open(workshop, workshop.markerFormId, canFastTravel, undefined, container, workshopListState.dockCorner, false, returnFocusId, onNavBack);
        }
    },

    getVisibleWorkshops(): SettlementDataWithRatings[] {
        const settlements = mapState.lastPayload?.settlements || [];
        return settlements.filter(s => s.owned || s.vassal);
    },

    mountLayout(container: HTMLElement): void {
        container.classList.add('collapsible-panel');
        container.classList.add('selectable-list');
        container.classList.add('workshop-list');
        container.innerHTML = `
          <div class="cp-header">
             <div class="cp-title">WORKSHOPS</div>
             <div class="cp-collapse-btn">
               <span class="cp-collapse-text">COLLAPSE</span>
               <span class="cp-btn-icon"></span>
            </div>
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
            dockCorner: workshopListState.dockCorner,
            initiallyCollapsed: workshopListState.isCollapsed,
            onToggle: (collapsed) => {
                if (collapsed) this.collapse();
                else this.expand();
            }
        });

        isLayoutMounted = true;
    },

    render(): void {
        const container = document.getElementById('workshop-list-panel');
        if (!container) return;

        DockControlsSystem.applyDockPosition(container, workshopListState.dockCorner);

        if (!isLayoutMounted) {
            this.mountLayout(container);
        }

        const isCollapsed = workshopListState.isCollapsed;
        container.setAttribute('data-collapsed', String(isCollapsed));

        const collapseTextEl = container.querySelector('.cp-collapse-text');
        if (collapseTextEl) {
            collapseTextEl.textContent = isCollapsed ? 'EXPAND' : 'COLLAPSE';
        }

        if (collapsiblePanel) {
            collapsiblePanel.updateGlyph();
        }

        const listEl = container.querySelector('.sl-items-list') as HTMLElement;
        if (!listEl) return;

        const savedScrollTop = listEl.scrollTop;
        const itemsToRender = this.getVisibleWorkshops();
        let itemsHtml = '';

        if (itemsToRender.length === 0) {
            itemsHtml = `<div class="sl-empty">NO WORKSHOPS</div>`;
        } else {
            itemsHtml = itemsToRender.map((w, idx) => this.renderWorkshopItem(w, idx)).join('');
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
        const container = document.getElementById('workshop-list-panel');
        if (!container) return;

        if (workshopListState.isCollapsed) {
            const items = container.querySelectorAll('.sl-item');
            items.forEach((item, idx) => {
                if (idx === workshopListState.hoverIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            SettlementCard.close();
            MarkerCard.close();
            if (customScrollbar) {
                customScrollbar.updateThumbPosition();
            }
            return;
        }

        listController.setSelectedIndex(listController.getSelectedIndex(), true, autoScroll);
    },

    renderWorkshopItem(workshop: SettlementDataWithRatings, index: number): string {
        const isSelected = !workshopListState.isCollapsed && index === listController.getSelectedIndex();
        const keyAttr = `data-marker-formid="${workshop.markerFormId}"`;
        
        const subtitle = getWorkshopSubtitle(workshop);

        const marker = mapState.lastPayload?.markers?.find(m => m.formId === workshop.markerFormId);
        const iconType = getWorkshopIconType(workshop, marker);
        const customIcon = marker ? marker.customIcon : undefined;
        const markerIconUrl = ThemeEngine.getMarkerIconUrl(iconType, true, customIcon);

        const badgesHtml = getWorkshopBadgesHtml(workshop);

        return `
          <div class="sl-item ${isSelected ? 'selected' : ''}" data-workshop-index="${index}" ${keyAttr} style="min-height: 44px; display: flex; align-items: center;">
             <div class="sl-item-content wl-item-content" style="padding-left: 5px; display: flex; align-items: center; width: 100%;">
                 <img class="wl-marker-icon" src="${markerIconUrl}" alt="Icon" style="width: 24px; height: 24px; margin-right: 10px; object-fit: contain;" />
                 <div class="wl-text-container" style="display: flex; flex-direction: column; justify-content: center; flex: 1;">
                     <div class="sl-item-title" style="display: flex; align-items: center; gap: 5px; line-height: 1.2;">
                         ${StringUtils.escapeHtml(workshop.name)}
                         ${badgesHtml}
                     </div>
                     <div class="wl-subtitle" style="font-size: 0.75em; opacity: 0.7; line-height: 1;">${subtitle}</div>
                 </div>
            </div>
          </div>
        `;
    }
};
