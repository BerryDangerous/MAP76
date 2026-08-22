import { F4SEMapPayload } from '@/types/payloads.js';

import { initializeF4SEBindings, EngineBridge } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';
import { requestSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { ThemeEngine } from '@/systems/assetManager.js';
import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager } from '@/systems/layoutManager.js';
import { MarkerInteractionManager } from '@/systems/markerController.js';
import { loadMarkers, applySupplyLinesVisibilityFilter, switchWorldspace, updatePlayerMarker } from '@/systems/markerRenderer.js';
import { ModalManager } from '@/systems/modalManager.js';
import { MapViewport } from '@/systems/viewport.js';

import { MapUtils } from '@/utils/mapUtils.js';

import { ControlBar } from '@/components/ControlsBar.js';
import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { InfoBar } from '@/components/InfoBar.js';
import { InfoCard } from '@/components/InfoCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { QuestCard } from '@/components/QuestCard.js';
import { QuestList } from '@/components/QuestsPanel.js';
import { SearchPanel } from '@/components/SearchPanel.js';
import { SettingsMenu } from '@/components/SettingsMenu.js';
import { SettlementCard } from '@/components/SettlementCard.js';
import { toggleSupplyLinesView, setSupplyLinesViewActive, hasSupplyLines } from '@/components/SupplyLines.js';
import { WorkshopList } from '@/components/WorkshopsPanel.js';

ThemeEngine.initMapConfig();

if (navigator.userAgent.includes('Ultralight')) {
    document.body.classList.add('is-ultralight');
}

let mapClosedFlag = true;

export function onMapOpened(): void {
    if (!mapClosedFlag) return;
    mapClosedFlag = false;
    EngineBridge.emitSound(appSettings.alternativeMapSound ? 'UIGeneralFocus' : 'UIPerkMenuEnter');
}

export function onMapClosed(): void {
    if (mapClosedFlag) return;
    mapClosedFlag = true;
    EngineBridge.emitSound(appSettings.alternativeMapSound ? 'UIGeneralFocus' : 'UIPerkMenuExit');
}

(window as any).onMapOpened = onMapOpened;
(window as any).onMapClosed = onMapClosed;

export function resetUIState(): void {
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    CustomMarkerCard.close();
    ModalManager.close();
    QuestCard.close();
    SettlementCard.close();
    MarkerCard.close();
    QuestList.collapse();
    WorkshopList.collapse();
    SearchPanel.collapse();
    SettingsMenu.forceClose();
}

(window as any).resetUIState = resetUIState;

initializeF4SEBindings((payload: F4SEMapPayload) => {
    requestSettings();
    loadMarkers(payload);
    InfoBar.initPlayer(payload.player);
    InfoCard.init(payload.player);
    QuestList.init();
    WorkshopList.init();
    QuestCard.init();
    SettlementCard.init();
    MarkerCard.init();
    CustomMarkerCard.init();
    SearchPanel.init();
    ControlBar.render(FocusManager.getFocus());
});

window.addEventListener('FrameTick', (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
        InfoCard.update(customEvent.detail);
        InfoBar.updateTime(customEvent.detail);
        if (customEvent.detail.player) {
            updatePlayerMarker(customEvent.detail.player);
        }
    }
});

window.addEventListener('settingsUpdated', () => {
    if (mapState.lastPayload) {
        loadMarkers(mapState.lastPayload);
    }
    QuestList.render?.();
    WorkshopList.render?.();
    SearchPanel.render?.();
});

function initCustomCursor() {
    const cursor = document.createElement('img');
    cursor.id = 'custom-map-cursor';
    cursor.src = 'assets/cursor.svg'; 
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e: MouseEvent) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        if (cursor.style.display !== 'block') {
            cursor.style.display = 'block';
        }
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.display = 'none';
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initCustomCursor();
    MapViewport.initEvents();
    MarkerInteractionManager.initEvents();
    MapViewport.centerInitialViewport();
    // AnimationEngine.startLoop();
    SettingsMenu.init();
    ControlBar.init();
    InfoBar.init();

    if (import.meta.env.DEV) {
        import('./dev/mock.js').then(({ initMockData }) => {
            initMockData();
        });
    } else if (window.requestFreshMapData) {
        window.requestFreshMapData(""); 
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            e.preventDefault();
        }

        if (KeybindsSystem.isAction(e, 'CLOSE_MAP') && FocusManager.getFocus() === 'MAP') {
            console.log('Closing map via CLOSE_MAP action...');
            resetUIState();
            onMapClosed();
            EngineBridge.closeMap();
            return;
        }

        const handledByFocus = FocusManager.handleKeyDown(e);
        if (handledByFocus) {
            return;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            if (SettingsMenu.isOpen) {
                e.stopPropagation();
                SettingsMenu.handleCloseRequest();
                return;
            }
            console.log('[KeyHandler] Focus is MAP. Closing map via NAV_BACK');
            e.stopPropagation();
            resetUIState();
            onMapClosed();
            EngineBridge.closeMap();
            return;
        }

        if (KeybindsSystem.isAction(e, 'OPEN_SETTINGS')) {
            SettingsMenu.toggle();
            return;
        }

        if (FocusManager.getFocus() === 'MAP') {
            if (KeybindsSystem.isAction(e, 'ZOOM_IN')) {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                MapViewport.performZoom('in', MapViewport.lastMouseX, MapViewport.lastMouseY);
                return;
            }
            if (KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                EngineBridge.emitSound('UIPipBoyMapZoom');
                MapViewport.performZoom('out', MapViewport.lastMouseX, MapViewport.lastMouseY);
                return;
            }
            if (KeybindsSystem.isAction(e, 'CENTER_CAMERA')) {
                e.preventDefault();
                EngineBridge.emitSound('UIPipBoyMapZoom');
                if (mapState.player) {
                    if (mapState.activeMapConfig) {
                        mapState.worldViewports[mapState.activeMapConfig.worldspaceID] = {
                            zoom: mapState.zoom,
                            panX: mapState.panX,
                            panY: mapState.panY
                        };
                    }
                    mapState.selectedWorldspaceID = null;
                    if (mapState.lastPayload) {
                        loadMarkers(mapState.lastPayload, true);
                    }
                    if (mapState.player.active) {
                        MapViewport.centerOnWorldCoords(mapState.player.x, mapState.player.y);
                    }
                }
                return;
            }
            if (KeybindsSystem.isAction(e, 'PLACE_MARKER')) {
                const config = mapState.activeMapConfig;
                const worldspaceData = mapState.lastPayload?.worldspaces?.[config.worldspaceID];
                const bounds = worldspaceData?.bounds;
                if (bounds) {
                    const worldCoords = MapUtils.screenToGameCoords(
                        MapViewport.lastMouseX, 
                        MapViewport.lastMouseY, 
                        bounds,
                        mapState.activeMapConfig!.gutters,
                        mapState.zoom,
                        mapState.panX,
                        mapState.panY
                    );
                    CustomMarkerCard.open({ gameCoords: worldCoords, pageCoords: { x: MapViewport.lastMouseX, y: MapViewport.lastMouseY }, worldspaceId: config.worldspaceID });
                    FocusManager.setFocus('CUSTOM_MARKER_CARD');
                }
                return;
            }
            if (KeybindsSystem.isAction(e, 'PREV_WORLD') || KeybindsSystem.isAction(e, 'NEXT_WORLD')) {
                if (!mapState.lastPayload || !mapState.lastPayload.worldspaces) return;
                
                const wsKeys = Object.keys(mapState.lastPayload.worldspaces).map(k => parseInt(k, 10));
                if (wsKeys.length <= 1) return;

                wsKeys.sort((a, b) => {
                    const getPriority = (id: number) => {
                        if (id === 60) return 0; // Commonwealth
                        if (id === 100673807) return 1; // Nuka-World
                        if (id === 50334479) return 2; // The Island
                        return 3;
                    };
                    const pA = getPriority(a);
                    const pB = getPriority(b);
                    if (pA !== pB) return pA - pB;

                    const nameA = mapState.lastPayload!.worldspaces![a].fullName.toLowerCase();
                    const nameB = mapState.lastPayload!.worldspaces![b].fullName.toLowerCase();
                    return nameA.localeCompare(nameB);
                });

                const currentIdx = wsKeys.indexOf(mapState.activeMapConfig.worldspaceID);
                let nextIdx = 0;
                if (KeybindsSystem.isAction(e, 'PREV_WORLD')) {
                    nextIdx = currentIdx > 0 ? currentIdx - 1 : wsKeys.length - 1;
                } else {
                    nextIdx = currentIdx < wsKeys.length - 1 ? currentIdx + 1 : 0;
                }
                EngineBridge.emitSound(appSettings.alternativeMapSound ? 'UIGeneralFocus' : 'UIPerkMenuEnter');
                switchWorldspace(wsKeys[nextIdx]);
                return;
            }

            const questCorner = QuestList.getState().dockCorner;
            const workshopCorner = WorkshopList.getState().dockCorner;
            if (LayoutManager.isExpandKey(e, questCorner)) {
                QuestList.expand();
            } else if (LayoutManager.isExpandKey(e, workshopCorner)) {
                WorkshopList.expand();
            } else if (LayoutManager.isExpandKey(e, SearchPanel.getState().dockCorner)) {
                SearchPanel.expand();
            } else if (KeybindsSystem.isAction(e, 'TOGGLE_SUPPLY_LINES')) {
                if (hasSupplyLines()) {
                    toggleSupplyLinesView();
                    if (mapState.lastPayload) {
                        loadMarkers(mapState.lastPayload);
                    } else {
                        applySupplyLinesVisibilityFilter();
                    }
                    window.dispatchEvent(new Event('settingsUpdated'));
                }
            }
        }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
        const handledByFocus = FocusManager.handleKeyUp(e);
        if (handledByFocus) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Closing map via Escape keyup...');
            resetUIState();
            onMapClosed();
            EngineBridge.closeMap();
            return;
        }
    });
});