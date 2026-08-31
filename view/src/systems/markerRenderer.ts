import { GameBounds, PlayerData, MapPosition, MapConfig } from '@/types/map.js';
import { CustomMarker, POIMarker, PowerArmorMarker, MarkerType } from '@/types/markers.js';
import { F4SEMapPayload } from '@/types/payloads.js';
import { QuestItem } from '@/types/quests.js';

import { ASSET_ICON_CUSTOM_MARKER, ASSET_ICON_POWER_ARMOR, ASSET_ICON_PLAYER_LOCATION, MARKER_ICON_RAIDER_OUTPOST, MARKER_ICON_VASSAL_SETTLEMENT, MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT, NAKANO_RESIDENCE_REAL_MARKER, NAKANO_RESIDENCE_FAKE_MARKER, ENGINE_MARKER_TYPES, DEFAULT_BLANK_CONFIG, NUKA_WORLD_MAP_GUTTERS, FAR_HARBOR_MAP_GUTTERS, DEFAULT_MAP_GUTTERS } from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { AssetManager } from '@/systems/assetManager.js';
import { MapViewport } from '@/systems/viewport.js';

import { MapUtils } from '@/utils/mapUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

import { InfoBar } from '@/components/InfoBar.js';
import { renderSupplyLines, isSupplyLinesViewActive, activeGatewayMarkerFormIds } from '@/components/SupplyLines.js';

function getPlayerLayer(): HTMLElement | null {
    return document.getElementById('player-layer');
}

function getMarkerLayer(): HTMLElement | null {
    return document.getElementById('marker-layer');
}

function getQuestLayer(): HTMLElement | null {
    let questLayer = document.getElementById('quest-layer');
    const markerLayer = getMarkerLayer();
    const playerLayer = getPlayerLayer();
    if (!questLayer && markerLayer && playerLayer) {
        questLayer = document.createElement('div');
        questLayer.id = 'quest-layer';
        markerLayer.parentNode?.insertBefore(questLayer, playerLayer);
    }
    return questLayer;
}

export function applySupplyLinesVisibilityFilter(): void {
    const isSupplyLineMode = isSupplyLinesViewActive();
    const questLayer = getQuestLayer();
    if (questLayer) {
        questLayer.style.display = isSupplyLineMode ? 'none' : '';
    }

    const markerLayer = getMarkerLayer();
    if (markerLayer) {
        const containers = markerLayer.querySelectorAll('.marker-container');
        containers.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (isSupplyLineMode) {
                const isOwnedWorkshop = htmlEl.dataset.isOwnedWorkshop === 'true';
                const formIdStr = htmlEl.dataset.formId;
                const formId = formIdStr ? parseInt(formIdStr, 10) : 0;
                const isGateway = activeGatewayMarkerFormIds.has(formId);
                
                htmlEl.style.display = (isOwnedWorkshop || isGateway) ? '' : 'none';
            } else {
                htmlEl.style.display = '';
            }
        });
    }
}

export function getPotentialVassalMarkerFormIds(
    outpostMarkerFormId: number, 
    payload: F4SEMapPayload | null
): Set<number> {
    const potentialFormIds = new Set<number>();
    if (!payload || !payload.settlements || !payload.markers || !payload.dlc04VassalDistance) {
        return potentialFormIds;
    }

    const vassalDistance = payload.dlc04VassalDistance;
    const vassalDistSq = vassalDistance * vassalDistance;

    const raiderSettlement = payload.settlements.find(s => 
        s.raider && (s.markerFormId === outpostMarkerFormId || s.formId === outpostMarkerFormId || s.locationFormId === outpostMarkerFormId)
    );
    if (!raiderSettlement) return potentialFormIds;

    const outpostMarker = payload.markers.find(m => m.formId === raiderSettlement.markerFormId);
    if (!outpostMarker) return potentialFormIds;

    payload.settlements.forEach(s => {
        if (s.raider || s.vassal || s.excludedFromVassal) return;

        const sMarker = payload.markers.find(m => m.formId === s.markerFormId);
        if (!sMarker) return;

        if (!WorldspaceUtils.isSameWorldspace(sMarker.worldspace, outpostMarker.worldspace)) return;

        const dx = sMarker.x - outpostMarker.x;
        const dy = sMarker.y - outpostMarker.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= vassalDistSq) {
            potentialFormIds.add(sMarker.formId);
        }
    });

    return potentialFormIds;
}

export function switchWorldspace(wsId: number) {
    if (mapState.activeMapConfig) {
        mapState.worldViewports[mapState.activeMapConfig.worldspaceID] = {
            zoom: mapState.zoom,
            panX: mapState.panX,
            panY: mapState.panY
        };
    }

    mapState.selectedWorldspaceID = wsId;
    
    if (mapState.lastPayload) {
        loadMarkers(mapState.lastPayload, true);
    }
}

export function loadMarkers(payload: F4SEMapPayload, isSwitchingWorld: boolean = false) {
    if (!payload) return;

    mapState.lastPayload = payload;

    let activeWsId = mapState.selectedWorldspaceID;
    if (activeWsId === null && payload.player && payload.player.worldspace !== undefined) {
        activeWsId = payload.player.worldspace;
    }

    if (activeWsId !== null && activeWsId !== undefined) {
        const editorID = WorldspaceUtils.getWorldspaceEditorID(activeWsId);
        updateWorldspaceConfig(activeWsId, editorID, isSwitchingWorld);
        InfoBar.updateWorldspace(activeWsId);
    }

    const config = mapState.activeMapConfig;
    if (!config) return;

    const playerLayer = getPlayerLayer();
    const markerLayer = getMarkerLayer();
    if (!playerLayer || !markerLayer) return;

    const worldspaceData = payload.worldspaces?.[config.worldspaceID];
    const bounds = worldspaceData?.bounds;
    if (!bounds) {
        console.error(`[Markers] No bounds data found for worldspace ${config.worldspaceID}`);
        return;
    }
    
    mapState.animatedElements = [];

    playerLayer.innerHTML = '';
    markerLayer.innerHTML = '';
    const questLayer = getQuestLayer();
    if (questLayer) questLayer.innerHTML = '';

    renderPlayer(payload.player, config.worldspaceID, bounds);
    renderSupplyLines(payload);
    renderLocationMarkers(payload.markers, config.worldspaceID, bounds, payload);
    if (questLayer) {
        renderQuestMarkers(payload.quests, config.worldspaceID, bounds, questLayer, payload);
        renderCustomMarker(payload.custom_marker, config.worldspaceID, bounds, questLayer, payload);
        renderPowerArmor(payload.power_armor, config.worldspaceID, bounds, questLayer, payload);
    }

    applySupplyLinesVisibilityFilter();
    if (isSwitchingWorld) {
        const saved = mapState.worldViewports[config.worldspaceID];
        if (saved) {
            mapState.zoom = saved.zoom;
            mapState.panX = saved.panX;
            mapState.panY = saved.panY;
            MapViewport.updateViewportTransform();
        } else {
            MapViewport.centerInitialViewport();
        }
    } else {
        MapViewport.updateViewportTransform();
    }
}

function renderPlayer(player: PlayerData | undefined, worldspaceID: number, bounds: GameBounds) {
    mapState.player.active = false;
    if (!player || !WorldspaceUtils.isSameWorldspace(player.worldspace, worldspaceID)) return;

    const pos = MapUtils.gameToMapCoords(player.x, player.y, player.z, bounds, mapState.activeMapConfig!.gutters!);
    const pImg = document.createElement('div');
    pImg.id = 'player-marker';
    pImg.className = 'player-marker-vector';
    pImg.innerHTML = AssetManager.getIconSvg(ASSET_ICON_PLAYER_LOCATION);
    pImg.style.left = `${pos.x}%`;
    pImg.style.top = `${pos.y}%`;

    mapState.player.x = player.x;
    mapState.player.y = player.y;
    mapState.player.z = player.z;
    mapState.player.angle = player.angle;
    mapState.player.active = true;

    getPlayerLayer()?.appendChild(pImg);
    mapState.animatedElements.push(pImg);
}

function renderLocationMarkers(markers: POIMarker[], worldspaceID: number, bounds: GameBounds, payload?: F4SEMapPayload) {
    const markerLayer = getMarkerLayer();
    if (!markerLayer) return;

    const realNakano = markers.find(m => m.pluginName === NAKANO_RESIDENCE_REAL_MARKER.plugin && m.localFormId === NAKANO_RESIDENCE_REAL_MARKER.localFormId);

    markers.forEach(m => {
        if (!WorldspaceUtils.isSameWorldspace(m.worldspace, worldspaceID)) return;

        if (m.pluginName === NAKANO_RESIDENCE_REAL_MARKER.plugin && m.localFormId === NAKANO_RESIDENCE_REAL_MARKER.localFormId) return;

        const isGateway = isSupplyLinesViewActive() && activeGatewayMarkerFormIds.has(m.formId);
        const shouldRender = m.visible || m.discovered || m.canFastTravel || isGateway;
        if (!shouldRender) return;

        let x = m.x;
        let y = m.y;

        if ((m.pluginName === NAKANO_RESIDENCE_FAKE_MARKER.plugin && m.localFormId === NAKANO_RESIDENCE_FAKE_MARKER.localFormId) && realNakano) {
            x = realNakano.x;
            y = realNakano.y;
        }

        const effectiveBounds = MapUtils.getEffectiveBounds(bounds);
        const isClamped = (x < effectiveBounds.minX || x > effectiveBounds.maxX || y < effectiveBounds.minY || y > effectiveBounds.maxY);

        if (isClamped) {
            x = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, x));
            y = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, y));
        }

        const pos = MapUtils.gameToMapCoords(x, y, 0, bounds, mapState.activeMapConfig!.gutters!);
        const container = createMarkerContainer('location', m.name, pos);
        if (isClamped) {
            container.classList.add('clamped-marker');
        }

        container.dataset.formId = m.formId.toString();

        const isOwnedWorkshop = payload?.settlements?.some(w => w.owned && (w.markerFormId === m.formId || w.formId === m.formId || w.locationFormId === m.formId));
        container.dataset.isOwnedWorkshop = isOwnedWorkshop ? 'true' : 'false';

        const isRaiderOutpost = payload?.settlements?.some(w => w.raider && (w.markerFormId === m.formId || w.formId === m.formId || w.locationFormId === m.formId));
        const isVassal = payload?.settlements?.some(w => w.vassal && (w.markerFormId === m.formId || w.formId === m.formId || w.locationFormId === m.formId));
        // The engine returns the default icon, not the runtime icon
        const iconType = isRaiderOutpost ? MARKER_ICON_RAIDER_OUTPOST :
                         isVassal ? MARKER_ICON_VASSAL_SETTLEMENT :
                         m.type;

        const defaultIconSvg = AssetManager.getLocationIconSvg(iconType, (m.discovered || m.canFastTravel), m.customIcon);
        container.dataset.defaultIconSvg = defaultIconSvg;

        const potentialVassalIconSvg = AssetManager.getLocationIconSvg(MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT, (m.discovered || m.canFastTravel), m.customIcon);
        container.dataset.potentialVassalIconSvg = potentialVassalIconSvg;
        container.dataset.isRaiderOutpost = isRaiderOutpost ? 'true' : 'false';

        container.innerHTML = defaultIconSvg;
        container.dataset.canFastTravel = m.canFastTravel.toString();

        markerLayer.appendChild(container);
    });
}

function renderQuestMarkers(quests: QuestItem[], worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement, payload: F4SEMapPayload) {
    if (!quests) return;

    quests.forEach(quest => {
        if (!quest.objectives) return;
        if (appSettings.hideInactiveQuestMarkers && !quest.isTracked) return;

        quest.objectives.forEach(objective => {
            if (objective.state !== 1) return;
            if (!objective.targets) return;

            const markerTooltipText = objective.text ? objective.text : quest.questName;

            objective.targets.forEach(target => {
                const refX = mapState.player.active ? mapState.player.x : 0;
                const refY = mapState.player.active ? mapState.player.y : 0;
                
                const resolved = WorldspaceUtils.resolveGatewayTarget(
                    target.worldspace,
                    worldspaceID,
                    target.x,
                    target.y,
                    target.z,
                    refX,
                    refY,
                    payload
                );

                if (!resolved) return;

                let gx = resolved.x;
                let gy = resolved.y;

                const effectiveBounds = MapUtils.getEffectiveBounds(bounds);
                const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

                if (resolved.isGateway || isClamped) {
                    gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
                    gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
                }

                const pos = MapUtils.gameToMapCoords(gx, gy, resolved.z, bounds, mapState.activeMapConfig!.gutters!);

                const container = createMarkerContainer('quest', markerTooltipText, pos);
                if (resolved.isGateway || isClamped) {
                    container.classList.add('clamped-marker');
                }
                container.classList.add('quest-marker');
                container.dataset.markerType = 'quest';
                if (quest.formId !== undefined) {
                    container.dataset.formId = quest.formId.toString();
                }

                container.innerHTML = AssetManager.getQuestMarkerIconSvg(target.isDoor, quest.isTracked);

                questLayer.appendChild(container);

                mapState.animatedElements.push(container);
            });
        });
    });
}

function renderCustomMarker(marker: CustomMarker | null | undefined, worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement, payload: F4SEMapPayload) {
    if (!marker) return;

    const resolved = WorldspaceUtils.resolveGatewayTarget(
        marker.worldspace,
        worldspaceID,
        marker.x,
        marker.y,
        0,
        mapState.player.active ? mapState.player.x : 0,
        mapState.player.active ? mapState.player.y : 0,
        payload
    );

    if (!resolved) return;

    let gx = resolved.x;
    let gy = resolved.y;

    const effectiveBounds = MapUtils.getEffectiveBounds(bounds);
    const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

    if (resolved.isGateway || isClamped) {
        gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
        gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
    }

    const pos = MapUtils.gameToMapCoords(gx, gy, 0, bounds, mapState.activeMapConfig!.gutters!);
    const container = createMarkerContainer('customMarker', 'Custom Marker', pos);
    if (resolved.isGateway || isClamped) {
        container.classList.add('clamped-marker');
    }
    container.classList.add('custom-marker');

    container.innerHTML = AssetManager.getIconSvg(ASSET_ICON_CUSTOM_MARKER);

    questLayer.appendChild(container);
    mapState.animatedElements.push(container);
}

function renderPowerArmor(pa: PowerArmorMarker | null | undefined, worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement, payload: F4SEMapPayload) {
    if (!pa) return;

    const refX = mapState.player.active ? mapState.player.x : 0;
    const refY = mapState.player.active ? mapState.player.y : 0;

    const resolved = WorldspaceUtils.resolveGatewayTarget(
        pa.worldspace,
        worldspaceID,
        pa.x,
        pa.y,
        pa.z ?? 0,
        refX,
        refY,
        payload
    );

    if (!resolved) return;

    let gx = resolved.x;
    let gy = resolved.y;

    const effectiveBounds = MapUtils.getEffectiveBounds(bounds);
    const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

    if (resolved.isGateway || isClamped) {
        gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
        gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
    }

    const pos = MapUtils.gameToMapCoords(gx, gy, resolved.z, bounds, mapState.activeMapConfig!.gutters!);
    const container = createMarkerContainer('powerarmor', 'Power Armor', pos);
    if (resolved.isGateway || isClamped) {
        container.classList.add('clamped-marker');
    }
    container.classList.add('power-armor-marker');

    container.innerHTML = AssetManager.getIconSvg(ASSET_ICON_POWER_ARMOR);

    questLayer.appendChild(container);
    mapState.animatedElements.push(container);
}

function createMarkerContainer(type: MarkerType, displayName: string, pos: MapPosition): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'marker-container';
    container.style.left = `${pos.x}%`;
    container.style.top = `${pos.y}%`;
    container.dataset.markerType = type;
    container.dataset.displayName = displayName;
    container.dataset.rawPctX = pos.x.toString();
    container.dataset.rawPctY = pos.y.toString();
    return container;
}

export function updatePlayerMarker(player: PlayerData | undefined) {
    if (!player) return;

    mapState.player.x = player.x;
    mapState.player.y = player.y;
    mapState.player.z = player.z;
    mapState.player.angle = player.angle;
    mapState.player.active = true;

    const config = mapState.activeMapConfig;
    if (!config) return;

    const pImg = document.getElementById('player-marker') as HTMLDivElement;
    if (!WorldspaceUtils.isSameWorldspace(player.worldspace, config.worldspaceID)) {
        if (pImg) pImg.style.display = 'none';
        mapState.player.active = false;
        return;
    }

    const worldspaceData = mapState.lastPayload?.worldspaces?.[config.worldspaceID];
    const bounds = worldspaceData?.bounds;
    if (!bounds) return;

    if (!pImg) {
        renderPlayer(player, config.worldspaceID, bounds);
    } else {
        pImg.style.display = '';
        const pos = MapUtils.gameToMapCoords(player.x, player.y, player.z, bounds, mapState.activeMapConfig!.gutters!);
        pImg.style.left = `${pos.x}%`;
        pImg.style.top = `${pos.y}%`;
        pImg.style.setProperty('--player-angle', `${player.angle}deg`);
    }
}

function calculateFinalGutters(config: MapConfig) {
    if (config.imageGuttersPixels && config.imageDimensions && config.imageDimensions.width > 0 && config.imageDimensions.height > 0) {
        return {
            left: config.imageGuttersPixels.left / config.imageDimensions.width,
            right: config.imageGuttersPixels.right / config.imageDimensions.width,
            top: config.imageGuttersPixels.top / config.imageDimensions.height,
            bottom: config.imageGuttersPixels.bottom / config.imageDimensions.height
        };
    }
    
    if (config.gutters) return config.gutters;

    switch (config.worldspaceEditorID) {
        case "NukaWorld": return NUKA_WORLD_MAP_GUTTERS;
        case "DLC03FarHarbor": return FAR_HARBOR_MAP_GUTTERS;
        default: return DEFAULT_MAP_GUTTERS;
    }
}

export function updateWorldspaceConfig(worldspaceID: number, worldspaceEditorID?: string, isSwitchingWorld: boolean = false) {
    if (worldspaceEditorID) {
        const preferredConfigID = appSettings.preferredMapConfigs[worldspaceEditorID];
        
        let config = preferredConfigID 
            ? AssetManager.getMapConfig(preferredConfigID) 
            : AssetManager.getDefaultMapConfigForWorldspace(worldspaceEditorID);

        if (config === DEFAULT_BLANK_CONFIG) {
            config = AssetManager.getDefaultMapConfigForWorldspace(worldspaceEditorID);
        }
        
        const finalGutters = calculateFinalGutters(config);


        mapState.activeMapConfig = {
            ...DEFAULT_BLANK_CONFIG,
            ...config,
            worldspaceID: worldspaceID,
            mapName: config.mapName || worldspaceEditorID,
            gutters: finalGutters,
            imageDimensions: config.imageDimensions,
            imageGuttersPixels: config.imageGuttersPixels
        };
    } else {
        mapState.activeMapConfig = {
            ...DEFAULT_BLANK_CONFIG,
            mapName: "Custom Worldspace",
            worldspaceID: worldspaceID
        };
    }

    const container = document.getElementById('map-bg-container');
    if (container) {
        const texturePath = mapState.activeMapConfig.texturePath;
        const textureData = AssetManager.getMapTextureData(texturePath);
        
        Array.from(container.children).forEach((child: Element) => {
            child.classList.remove('active');
        });

        const layerId = `map-layer-${texturePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let activeLayer = document.getElementById(layerId);

        if (activeLayer) {
            activeLayer.classList.add('active');
        } else {
            console.warn(`[Map] Expected layer ${layerId} was not preloaded into DOM. Fallback triggered.`);
            const layer = AssetManager.createMapLayer(layerId, textureData, mapState.activeMapConfig, true);
            container.appendChild(layer);
        }
    }
}
