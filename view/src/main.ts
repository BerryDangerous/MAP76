import { FastTravelStatus, PlayerData } from '@/types/map.js';
import { F4SEMapPayload, FastTravelCheckPayload, FastTravelFailPayload, SettlementData } from '@/types/payloads.js';
import { MarkerKind } from '@/types/seams.js';

import { initializeF4SEBindings, EngineBridge } from '@/core/bridge.js';
import { appSettings, requestSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager } from '@/systems/layoutManager.js';
import { ModalManager } from '@/systems/modalManager.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';

import { mapSurface, MapSurface } from '@/map/index.js';

import { ControlBar } from '@/components/ControlsBar.js';
import { CustomMarkerCard } from '@/components/CustomMarkerCard.js';
import { InfoBar } from '@/components/InfoBar.js';
import { InfoCard } from '@/components/InfoCard.js';
import { MarkerCard } from '@/components/MarkerCard.js';
import { QuestCard } from '@/components/QuestCard.js';
import { QuestList } from '@/components/QuestsPanel.js';
import { SearchPanel } from '@/components/SearchPanel.js';
import { SettingsMenu } from '@/components/SettingsMenu.js';
import { SettlementCard, renderSettlementCardContent } from '@/components/SettlementCard.js';
import { LocationsList } from '@/components/WorkshopsPanel.js';
import { showFastTravelConfirmationModal, showFastTravelErrorModal } from '@/components/Modals.js';
import { FloatingCard } from '@/components/ui/FloatingCard.js';

import { injectSVGFilters } from '@/utils/svgFilters.js';

const globalConfig = window.DEFAULT_COMMONWEALTH_CONFIG;
if (globalConfig) {
    mapSurface.setWorldspaceConfig(globalConfig.worldspaceID, globalConfig);
    console.log(`[Init] Overrode layout using global config: ${globalConfig.mapName}`);
} else {
    console.log('[Init] Using built-in hardcoded map configuration fallback.');
}

if (navigator.userAgent.includes('Ultralight')) {
    document.body.classList.add('is-ultralight');
}

let mapClosedFlag = true;
let pendingFastTravel: { formId: number; name: string } | null = null;

function wireMapEventsToCards(surface: MapSurface) {
    surface.events.on('viewportChange', () => {
        FloatingCard.repositionAll();
    });

    surface.events.on('worldspaceChange', (payload) => {
        InfoBar.updateWorldspace(payload.worldspaceId);
    });

    surface.events.on('markerSelect', (payload) => {
        SoundService.playFocus();
        mapSurface.clearSavedViewport(false);

        switch (payload.kind) {
            case MarkerKind.QUEST: {
                let matchingQuest = domainState.quests.get(payload.questFormId);
                if (!matchingQuest) {
                    for (const q of domainState.quests.values()) {
                        if (q.formId === payload.questFormId) {
                            matchingQuest = q;
                            break;
                        }
                    }
                }
                if (matchingQuest) {
                    const anchorEl = document.querySelector(`.quest-marker[data-form-id="${payload.questFormId}"]`) as HTMLElement | null;
                    QuestCard.open(matchingQuest, anchorEl || undefined);
                }
                break;
            }
            case MarkerKind.CUSTOM: {
                const anchorEl = document.querySelector('.custom-marker') as HTMLElement | null;
                CustomMarkerCard.open({ anchorMarker: anchorEl });
                break;
            }
            case MarkerKind.POI: {
                const targetMarker = domainState.markers.get(payload.formId);
                const anchorEl = document.querySelector(`.marker-container[data-form-id="${payload.formId}"]`) as HTMLElement | null;
                const canTravel = targetMarker ? (targetMarker.canFastTravel || targetMarker.discovered) : false;

                let ownedSettlement: SettlementData | undefined;
                for (const w of domainState.settlements.values()) {
                    if (w.owned && (w.markerFormId === payload.formId || w.formId === payload.formId || w.locationFormId === payload.formId)) {
                        ownedSettlement = w;
                        break;
                    }
                }

                if (ownedSettlement) {
                    renderSettlementCardContent(document.body, ownedSettlement, payload.formId, canTravel, anchorEl || undefined);
                } else if (targetMarker) {
                    MarkerCard.open(targetMarker.name, payload.formId, canTravel, anchorEl || undefined);
                }
                break;
            }
            case MarkerKind.POWER_ARMOR: {
                break;
            }
        }
    });

    surface.events.on('emptyMapClick', (payload) => {
        CustomMarkerCard.open({
            gameCoords: payload.worldCoordinates,
            pageCoords: payload.screenCoordinates,
            worldspaceId: payload.worldspaceId
        });
        FocusManager.setFocus('CUSTOM_MARKER_CARD');
    });

    surface.events.on('fastTravelRequest', (payload) => {
        pendingFastTravel = { formId: payload.formId, name: payload.name };
        EngineBridge.checkFastTravelConditions(payload.formId);
    });

    window.addEventListener('FastTravelCheckResult', (e: Event) => {
        if (!pendingFastTravel) return;
        const detail = (e as CustomEvent<FastTravelCheckPayload>).detail;
        
        if (detail.status === FastTravelStatus.SUCCESS) {
            const { formId, name } = pendingFastTravel;
            showFastTravelConfirmationModal(name, () => {
                mapSurface.prepareForFastTravel(formId);
                EngineBridge.requestFastTravel(formId);
                if (FocusManager.getFocus() === 'MARKER_CARD') {
                    MarkerCard.close();
                } else if (FocusManager.getFocus() === 'SETTLEMENT_CARD') {
                    SettlementCard.close();
                }
            });
        } else {
            showFastTravelErrorModal(detail.status);
        }
        pendingFastTravel = null;
    });

    window.addEventListener('FastTravelFailed', (e: Event) => {
        const detail = (e as CustomEvent<FastTravelFailPayload>).detail;
        showFastTravelErrorModal(detail.status);
    });
}

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
                mapSurface.setPendingCenterOnPlayer(true);
            }
            mapSurface.render(true);
        } else {
            mapSurface.updatePlayer(playerData);
        }
    }

    if (appSettings.centerOnPlayerWhenOpened) {
        if (domainState.player && domainState.player.active) {
            mapSurface.centerOnWorldCoords(domainState.player.x, domainState.player.y);
            mapSurface.setPendingCenterOnPlayer(false);
        } else {
            mapSurface.setPendingCenterOnPlayer(true);
        }
    }
}

export function onMapClosed(): void {
    if (mapClosedFlag) return;
    mapClosedFlag = true;
    SoundService.playMapClose();
    
    if (appSettings.centerOnPlayerWhenOpened) {
        mapSurface.setPendingCenterOnPlayer(true);
        domainState.setSelectedWorldspace(null);
        mapSurface.clearSavedViewport(false);
        if (domainState.lastPayload) {
            mapSurface.render(true);
        }
    }
}

export function setInitialWorldspace(worldspaceId: number, editorId: string): void {
    if (domainState.selectedWorldspaceID !== null && domainState.selectedWorldspaceID !== undefined) {
        return;
    }

    domainState.updatePlayer({ worldspace: worldspaceId });
    mapSurface.updateWorldspaceConfig(worldspaceId, editorId);
}

(window as any).onMapOpened = onMapOpened;
(window as any).onMapClosed = onMapClosed;
(window as any).setInitialWorldspace = setInitialWorldspace;

export function resetUIState(): void {
    mapSurface.setSupplyLinesActive(false);
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
    domainState.setPayload(payload);
    mapSurface.render();
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
                    mapSurface.setPendingCenterOnPlayer(true);
                    mapSurface.render(true);
                } else {
                    mapSurface.updatePlayer(player);
                    mapSurface.centerOnWorldCoords(player.x, player.y);
                }
            } else {
                mapSurface.updatePlayer(player);
            }
        }
    }
});

window.addEventListener('settingsUpdated', () => {
    mapSurface.invalidateConfig();
    if (domainState.lastPayload) {
        mapSurface.render();
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

    const viewportElement = document.getElementById('map-viewport');
    if (viewportElement) {
        mapSurface.init({
            viewportElement,
            containerElement: document.getElementById('screen-container') ?? undefined,
            markerLayer: document.getElementById('marker-layer') ?? undefined,
            playerLayer: document.getElementById('player-layer') ?? undefined,
            questLayer: document.getElementById('quest-layer') ?? undefined,
            supplyLinesLayer: (document.getElementById('supply-lines-layer') as unknown as SVGSVGElement) ?? undefined
        });
        wireMapEventsToCards(mapSurface);
    }

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
                    mapSurface.setZoomHold('in');
                    return;
                }
                if (KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                    if (!e.repeat) SoundService.playMapZoom();
                    mapSurface.setZoomHold('out');
                    return;
                }
                if (KeybindsSystem.isAction(e, 'CENTER_CAMERA')) {
                    e.preventDefault();
                    SoundService.playMapZoom();
                    if (domainState.player) {
                        mapSurface.saveCurrentWorldViewport();
                        domainState.setSelectedWorldspace(null);
                        if (domainState.lastPayload) {
                            mapSurface.render(true);
                        }
                        if (domainState.player.active) {
                            mapSurface.centerOnWorldCoords(domainState.player.x, domainState.player.y);
                        }
                    }
                    return;
                }
                if (KeybindsSystem.isAction(e, 'SELECT')) {
                    if (mapSurface.activateHoveredMarker()) {
                        return;
                    }
                }
                if (KeybindsSystem.isAction(e, 'PLACE_MARKER')) {
                    mapSurface.triggerCustomMarkerPlacement();
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

                    const currentIdx = wsKeys.indexOf(domainState.getActiveWorldspaceID());
                    let nextIdx = 0;
                    if (KeybindsSystem.isAction(e, 'PREV_WORLD')) {
                        nextIdx = currentIdx > 0 ? currentIdx - 1 : wsKeys.length - 1;
                    } else {
                        nextIdx = currentIdx < wsKeys.length - 1 ? currentIdx + 1 : 0;
                    }
                    SoundService.playMapOpen();
                    mapSurface.switchWorldspace(wsKeys[nextIdx]);
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
                    if (mapSurface.hasSupplyLines()) {
                        mapSurface.toggleSupplyLines();
                        if (domainState.lastPayload) {
                            mapSurface.render();
                        }
                        window.dispatchEvent(new Event('settingsUpdated'));
                    }
                }
            }
        } else if (e.type === 'keyup') {
            if (KeybindsSystem.isAction(e, 'ZOOM_IN') || KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                mapSurface.setZoomHold(null);
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