import { F4SEMapPayload } from '@/types/payloads.js';
import { PlayerData } from '@/types/map.js';

import { initializeF4SEBindings, EngineBridge } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';
import { requestSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';
import { viewportState } from '@/map/viewportState.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager } from '@/systems/layoutManager.js';
import { MarkerInteractionManager, activeHoveredMarker } from '@/systems/markerController.js';
import { loadMarkers, applySupplyLinesVisibilityFilter, switchWorldspace, updatePlayerMarker, updateWorldspaceConfig } from '@/systems/markerRenderer.js';
import { ModalManager } from '@/systems/modalManager.js';
import { MapViewport } from '@/systems/viewport.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';

import { MapUtils } from '@/utils/mapUtils.js';
import { injectSVGFilters } from '@/utils/svgFilters.js';

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
import { LocationsList } from '@/components/WorkshopsPanel.js';

const globalConfig = window.DEFAULT_COMMONWEALTH_CONFIG;
if (globalConfig) {
    domainState.setActiveMapConfig(globalConfig);
    console.log(`[Init] Overrode layout using global config: ${globalConfig.mapName}`);
} else {
    console.log('[Init] Using built-in hardcoded map configuration fallback.');
}

if (navigator.userAgent.includes('Ultralight')) {
    document.body.classList.add('is-ultralight');
}

let mapClosedFlag = true;

export function onMapOpened(playerData?: PlayerData): void {
    if (!mapClosedFlag) return;
    mapClosedFlag = false;
    SoundService.playMapOpen();
    
    if (playerData) {
        const isWorldChange = domainState.lastPayload?.player?.worldspace !== undefined &&
                              playerData.worldspace !== domainState.lastPayload.player.worldspace;
        
        if (isWorldChange && domainState.lastPayload && domainState.lastPayload.player) {
            domainState.lastPayload.player.x = playerData.x;
            domainState.lastPayload.player.y = playerData.y;
            domainState.lastPayload.player.z = playerData.z;
            domainState.lastPayload.player.angle = playerData.angle;
            domainState.lastPayload.player.worldspace = playerData.worldspace;
            domainState.setSelectedWorldspace(null);
            if (appSettings.centerOnPlayerWhenOpened) {
                viewportState.pendingCenterOnPlayer = true;
            }
            loadMarkers(domainState.lastPayload, true);
        } else {
            updatePlayerMarker(playerData);
        }
    }

    if (appSettings.centerOnPlayerWhenOpened) {
        const config = domainState.activeMapConfig;
        const bounds = domainState.lastPayload?.worldspaces?.[config.worldspaceID]?.bounds;
        if (domainState.player && domainState.player.active && bounds) {
            MapViewport.centerOnWorldCoords(domainState.player.x, domainState.player.y);
            viewportState.pendingCenterOnPlayer = false;
        } else {
            viewportState.pendingCenterOnPlayer = true;
        }
    }
}

export function onMapClosed(): void {
    if (mapClosedFlag) return;
    mapClosedFlag = true;
    SoundService.playMapClose();
    
    if (appSettings.centerOnPlayerWhenOpened) {
        viewportState.pendingCenterOnPlayer = true;
        domainState.setSelectedWorldspace(null);
        viewportState.savedViewport = null;
        if (domainState.lastPayload) {
            loadMarkers(domainState.lastPayload, true);
        }
    }
}

export function setInitialWorldspace(worldspaceId: number, editorId: string): void {
    if (domainState.selectedWorldspaceID !== null && domainState.selectedWorldspaceID !== undefined) {
        return;
    }

    updateWorldspaceConfig(worldspaceId, editorId);
}

(window as any).onMapOpened = onMapOpened;
(window as any).onMapClosed = onMapClosed;
(window as any).setInitialWorldspace = setInitialWorldspace;

export function resetUIState(): void {
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    CustomMarkerCard.close();
    ModalManager.close();
    QuestCard.close();
    SettlementCard.close();
    MarkerCard.close();
    QuestList.collapse();
    LocationsList.collapse();
    SearchPanel.collapse();
    SettingsMenu.forceClose();
}

(window as any).resetUIState = resetUIState;

initializeF4SEBindings(async (payload: F4SEMapPayload) => {
    requestSettings();
    loadMarkers(payload);
    InfoCard.init(payload.player);
    QuestList.init();
    LocationsList.init();
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
        if (!mapClosedFlag) {
            InfoCard.update(customEvent.detail);
            InfoBar.updateTime(customEvent.detail);
        }
        if (customEvent.detail.player) {
            const player = customEvent.detail.player;
            if (mapClosedFlag) {
                if (!appSettings.centerOnPlayerWhenOpened) {
                    return;
                }
                const isWorldChange = domainState.lastPayload?.player?.worldspace !== undefined &&
                                      player.worldspace !== domainState.lastPayload.player.worldspace;
                if (isWorldChange && domainState.lastPayload && domainState.lastPayload.player) {
                    domainState.updatePlayer(player);
                    domainState.setSelectedWorldspace(null);
                    viewportState.pendingCenterOnPlayer = true;
                    loadMarkers(domainState.lastPayload, true);
                } else {
                    updatePlayerMarker(player);
                    MapViewport.centerOnWorldCoords(player.x, player.y);
                }
            } else {
                updatePlayerMarker(player);
            }
        }
    }
});

window.addEventListener('settingsUpdated', () => {
    if (domainState.lastPayload) {
        loadMarkers(domainState.lastPayload);
    }
    QuestList.render?.();
    LocationsList.render?.();
    SearchPanel.render?.();
});

function initCustomCursor() {
    const cursor = document.createElement('img');
    cursor.id = 'custom-cursor';
    cursor.src = 'assets/cursor.svg'; 
    document.body.appendChild(cursor);

    let cursorFramePending = false;
    let lastClientX = 0;
    let lastClientY = 0;
    let lastTarget: HTMLElement | null = null;

    window.addEventListener('mousemove', (e: MouseEvent) => {
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        lastTarget = e.target as HTMLElement;

        if (!cursorFramePending) {
            cursorFramePending = true;
            requestAnimationFrame(() => {
                cursorFramePending = false;

                cursor.style.left = `${lastClientX}px`;
                cursor.style.top = `${lastClientY}px`;
                if (cursor.style.display !== 'block') {
                    cursor.style.display = 'block';
                }

                if (lastTarget) {
                    const mapElements = ['map-bg', 'map-bg-container', 'map-viewport', 'marker-layer', 'supply-lines-layer'];
                    const isMapHover = mapElements.includes(lastTarget.id) || lastTarget.closest('.marker-container') !== null || lastTarget.closest('#map-bg-container') !== null;
                    const desiredCursor = isMapHover ? 'assets/cursor2.svg' : 'assets/cursor.svg';

                    if (cursor.getAttribute('src') !== desiredCursor) {
                        cursor.setAttribute('src', desiredCursor);
                        cursor.classList.toggle('map', isMapHover);
                    }
                }
            });
        }
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.display = 'none';
    });
}

window.addEventListener('DOMContentLoaded', () => {
    injectSVGFilters();
    initCustomCursor();
    MapViewport.initEvents();
    MarkerInteractionManager.initEvents();
    MapViewport.centerInitialViewport();
    OverlayManager.init();
    SettingsMenu.init();
    ControlBar.init();
    InfoBar.init();

    if (import.meta.env.DEV) {
        import('./dev/mock.js').then(({ initMockData }) => {
            initMockData();
            if (typeof window.requestAssetCache === 'function') {
                window.requestAssetCache("");
            }
        });
    } else if (window.requestFreshMapData) {
        window.requestFreshMapData(""); 
    }

    KeybindsSystem.initGlobalListeners((e: KeyboardEvent) => {
        if (e.type === 'keydown') {
            if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (KeybindsSystem.isAction(e, 'CLOSE_MAP')) {
                console.log('Closing map via CLOSE_MAP action...');
                e.preventDefault();
                resetUIState();
                onMapClosed();
                EngineBridge.closeMap();
                return;
            }

            if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
                console.log('[KeyHandler] Focus is MAP. Closing map via NAV_BACK');
                e.preventDefault();
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
                    if (!e.repeat) SoundService.playMapZoom();
                    MapViewport.setZoomHold('in', MapViewport.lastMouseX, MapViewport.lastMouseY);
                    return;
                }
                if (KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                    if (!e.repeat) SoundService.playMapZoom();
                    MapViewport.setZoomHold('out', MapViewport.lastMouseX, MapViewport.lastMouseY);
                    return;
                }
                if (KeybindsSystem.isAction(e, 'CENTER_CAMERA')) {
                    e.preventDefault();
                    SoundService.playMapZoom();
                    if (domainState.player) {
                        if (domainState.activeMapConfig) {
                            viewportState.worldViewports[domainState.activeMapConfig.worldspaceID] = {
                                zoom: viewportState.zoom,
                                panX: viewportState.panX,
                                panY: viewportState.panY
                            };
                        }
                        domainState.setSelectedWorldspace(null);
                        if (domainState.lastPayload) {
                            loadMarkers(domainState.lastPayload, true);
                        }
                        if (domainState.player.active) {
                            MapViewport.centerOnWorldCoords(domainState.player.x, domainState.player.y);
                        }
                    }
                    return;
                }
                if (KeybindsSystem.isAction(e, 'SELECT')) {
                    if (activeHoveredMarker) {
                        activeHoveredMarker.click();
                        return;
                    }
                }
                if (KeybindsSystem.isAction(e, 'PLACE_MARKER')) {
                    const config = domainState.activeMapConfig;
                    const worldspaceData = domainState.lastPayload?.worldspaces?.[config.worldspaceID];
                    const bounds = worldspaceData?.bounds;
                    if (bounds) {
                        const worldCoords = MapUtils.screenToGameCoords(
                            MapViewport.lastMouseX, 
                            MapViewport.lastMouseY, 
                            bounds,
                            domainState.activeMapConfig!.gutters!,
                            viewportState.zoom,
                            viewportState.panX,
                            viewportState.panY
                        );
                        CustomMarkerCard.open({ gameCoords: worldCoords, pageCoords: { x: MapViewport.lastMouseX, y: MapViewport.lastMouseY }, worldspaceId: config.worldspaceID });
                        FocusManager.setFocus('CUSTOM_MARKER_CARD');
                    }
                    return;
                }
                if (KeybindsSystem.isAction(e, 'PREV_WORLD') || KeybindsSystem.isAction(e, 'NEXT_WORLD')) {
                    if (!domainState.lastPayload || !domainState.lastPayload.worldspaces) return;
                    
                    const wsKeys = Object.keys(domainState.lastPayload.worldspaces).map(k => parseInt(k, 10));
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

                        const nameA = domainState.lastPayload!.worldspaces![a].fullName.toLowerCase();
                        const nameB = domainState.lastPayload!.worldspaces![b].fullName.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });

                    const currentIdx = wsKeys.indexOf(domainState.activeMapConfig.worldspaceID);
                    let nextIdx = 0;
                    if (KeybindsSystem.isAction(e, 'PREV_WORLD')) {
                        nextIdx = currentIdx > 0 ? currentIdx - 1 : wsKeys.length - 1;
                    } else {
                        nextIdx = currentIdx < wsKeys.length - 1 ? currentIdx + 1 : 0;
                    }
                    SoundService.playMapOpen();
                    switchWorldspace(wsKeys[nextIdx]);
                    return;
                }

                const questCorner = QuestList.getState().dockCorner;
                const workshopCorner = LocationsList.getState().dockCorner;
                const searchCorner = SearchPanel.getState().dockCorner;
                
                const questConfig = LayoutManager.getCornerConfig(questCorner);
                const workshopConfig = LayoutManager.getCornerConfig(workshopCorner);
                const searchConfig = LayoutManager.getCornerConfig(searchCorner);

                if (KeybindsSystem.isPanelExpandKey(e, questConfig.expandKey)) {
                    QuestList.expand();
                } else if (KeybindsSystem.isPanelExpandKey(e, workshopConfig.expandKey)) {
                    LocationsList.expand();
                } else if (KeybindsSystem.isPanelExpandKey(e, searchConfig.expandKey)) {
                    SearchPanel.expand();
                } else if (KeybindsSystem.isAction(e, 'TOGGLE_SUPPLY_LINES')) {
                    if (hasSupplyLines()) {
                        toggleSupplyLinesView();
                        if (domainState.lastPayload) {
                            loadMarkers(domainState.lastPayload);
                        } else {
                            applySupplyLinesVisibilityFilter();
                        }
                        window.dispatchEvent(new Event('settingsUpdated'));
                    }
                }
            }
        } else if (e.type === 'keyup') {
            if (KeybindsSystem.isAction(e, 'ZOOM_IN') || KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                MapViewport.setZoomHold(null, MapViewport.lastMouseX, MapViewport.lastMouseY);
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
        }
    });
});