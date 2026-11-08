import { FastTravelStatus, PlayerData } from '@/types/map.js';
import { F4SEMapPayload, FastTravelCheckPayload, FastTravelFailPayload, SettlementData } from '@/types/payloads.js';
import { MarkerKind } from '@/types/seams.js';

import { initializeF4SEBindings, EngineBridge } from '@/core/bridge.js';
import { appSettings, requestSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';

import { FocusManager, InputRouter, cursorManager } from '@/input/index.js';
import { LayoutManager } from '@/systems/layoutManager.js';
import { ModalManager } from '@/systems/modalManager.js';
import { OverlayManager } from '@/managers/overlayManager.js';
import { SoundService } from '@/services/soundService.js';

import { mapSurface, MapSurface, mapInputReceiver } from '@/map/index.js';

import { ControlBar } from '@/components/ControlsBar.js';
import { InfoBar } from '@/components/InfoBar.js';
import { InfoCard } from '@/components/InfoCard.js';
import {
    CustomMarkerCard,
    MarkerCard,
    QuestCard,
    QuestList,
    SearchPanel,
    SettlementCard,
    renderSettlementCardContent,
    LocationsList
} from '@/overlays/index.js';
import { SettingsMenu } from '@/components/SettingsMenu.js';
import { showFastTravelConfirmationModal, showFastTravelErrorModal } from '@/components/Modals.js';
import { FloatingCard } from '@/ui/index.js';

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

window.addEventListener('DOMContentLoaded', () => {
    injectSVGFilters();
    cursorManager.init();

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

    InputRouter.init();
    InputRouter.setCloseMapHandler(() => {
        resetUIState();
        onMapClosed();
        EngineBridge.closeMap();
    });
    InputRouter.push(mapInputReceiver);
});