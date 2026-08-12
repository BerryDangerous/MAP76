import { mapState } from '../core/state.js';
import { ThemeEngine } from '../systems/theme.js';
import { GameBounds, PlayerData, MapPosition } from '../types/map.js';
import { CustomMarker, POIMarker, PowerArmorMarker, MarkerType } from '../types/markers.js';
import { F4SEMapPayload } from '../types/payloads.js';
import { QuestItem } from '../types/quests.js';
import { MapViewport } from './viewport.js';
import { appSettings } from '../core/settings.js';
import { MARKER_ICON_QUEST_TARGET, MARKER_ICON_QUEST_DOOR, MARKER_ICON_CUSTOM_MARKER, MARKER_ICON_POWER_ARMOR, MARKER_ICON_RAIDER_OUTPOST, MARKER_ICON_VASSAL_SETTLEMENT, MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT } from '../core/constants.js';
import { renderSupplyLines, isSupplyLinesViewActive } from './supplyLines.js';
import { WorldspaceUtils } from '../utils/worldspaceUtils.js';

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
                htmlEl.style.display = isOwnedWorkshop ? '' : 'none';
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

export function loadMarkers(payload: F4SEMapPayload) {
    if (!payload) return;

    mapState.lastPayload = payload;

    if (payload.player && payload.player.worldspace !== undefined) {
        const wsId = payload.player.worldspace;
        const editorID = WorldspaceUtils.getWorldspaceEditorID(wsId);
        ThemeEngine.updateWorldspaceConfig(wsId, editorID);
    }

    const config = mapState.activeMapConfig;
    if (!config) return;

    const playerLayer = getPlayerLayer();
    const markerLayer = getMarkerLayer();
    if (!playerLayer || !markerLayer) return;

    const bounds = payload.bounds;
    mapState.currentPayloadBounds = bounds;
    mapState.animatedElements = [];

    playerLayer.innerHTML = '';
    markerLayer.innerHTML = '';
    const questLayer = getQuestLayer();
    if (questLayer) questLayer.innerHTML = '';

    renderPlayer(payload.player, config.worldspaceID, bounds);
    renderLocationMarkers(payload.markers, config.worldspaceID, bounds, payload);
    if (questLayer) {
        renderQuestMarkers(payload.quests, config.worldspaceID, bounds, questLayer);
        renderCustomMarker(payload.custom_marker, config.worldspaceID, bounds, questLayer);
        renderPowerArmor(payload.power_armor, config.worldspaceID, bounds, questLayer);
    }

    renderSupplyLines(payload);
    applySupplyLinesVisibilityFilter();

    MapViewport.updateViewportTransform();
}

function renderPlayer(player: PlayerData | undefined, worldspaceID: number, bounds: GameBounds) {
    mapState.player.active = false;
    if (!player || !WorldspaceUtils.isSameWorldspace(player.worldspace, worldspaceID)) return;

    const pos = MapViewport.gameToMapCoords(player.x, player.y, player.z, bounds);
    const pImg = document.createElement('img');
    pImg.id = 'player-marker';
    pImg.className = 'player-marker-vector';
    pImg.src = ThemeEngine.getPlayerIconUrl();
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

    const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = MapViewport.getEffectiveBounds(bounds);

    markers.forEach(m => {
        if (!WorldspaceUtils.isSameWorldspace(m.worldspace, worldspaceID)) return;

        const shouldRender = m.visible || m.discovered || m.canFastTravel;
        if (!shouldRender) return;

        let x = m.x;
        let y = m.y;
        const isClamped = appSettings.clampQuestMarkers && (x < bMinX || x > bMaxX || y < bMinY || y > bMaxY);

        if (isClamped) {
            x = Math.max(bMinX, Math.min(bMaxX, x));
            y = Math.max(bMinY, Math.min(bMaxY, y));
        }

        const pos = MapViewport.gameToMapCoords(x, y, 0, bounds);
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

        const defaultIconUrl = ThemeEngine.getMarkerIconUrl(iconType, (m.discovered || m.canFastTravel), m.customIcon);
        container.dataset.defaultIconUrl = defaultIconUrl;

        const potentialVassalIconUrl = ThemeEngine.getMarkerIconUrl(MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT, (m.discovered || m.canFastTravel), m.customIcon);
        container.dataset.potentialVassalIconUrl = potentialVassalIconUrl;
        container.dataset.isRaiderOutpost = isRaiderOutpost ? 'true' : 'false';

        const img = document.createElement('img');
        img.src = defaultIconUrl;
        container.dataset.canFastTravel = m.canFastTravel.toString();
        const tag = createMarkerTag(m.name);

        container.appendChild(img);
        container.appendChild(tag);
        markerLayer.appendChild(container);
    });
}

function renderQuestMarkers(quests: QuestItem[], worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement) {
    if (!quests) return;

    quests.forEach(quest => {
        if (!quest.objectives) return;

        quest.objectives.forEach(objective => {
            if (objective.state !== 1) return;
            if (!objective.targets) return;

            const markerTooltipText = objective.text ? objective.text : quest.questName;

            objective.targets.forEach(target => {
                if (!WorldspaceUtils.isSameWorldspace(target.worldspace, worldspaceID)) return;

                const pos = MapViewport.gameToMapCoords(target.x, target.y, target.z, bounds);

                const container = createMarkerContainer('quest', markerTooltipText, pos);
                container.classList.add('quest-marker');
                container.dataset.markerType = 'quest';
                if (quest.formId !== undefined) {
                    container.dataset.formId = quest.formId.toString();
                }

                const img = document.createElement('img');
                img.src = ThemeEngine.getMarkerIconUrl(target.isDoor ? MARKER_ICON_QUEST_DOOR : MARKER_ICON_QUEST_TARGET, true);

                if (mapState.player.active) {
                    const zThreshold = 500;
                    const zDelta = target.z - mapState.player.z;

                    if (Math.abs(zDelta) > zThreshold) {
                        const arrowImg = document.createElement('img');
                        arrowImg.className = 'altitude-arrow';

                        if (target.isDoor) {
                            arrowImg.classList.add('door-offset');
                        }

                        if (zDelta > 0) {
                            arrowImg.src = 'assets/icons/default/quest-altitude-up.svg';
                        } else {
                            arrowImg.src = 'assets/icons/default/quest-altitude-down.svg';
                        }
                        container.appendChild(arrowImg);
                    }
                }

                const tag = createMarkerTag(markerTooltipText);
                container.appendChild(img);
                container.appendChild(tag);
                questLayer.appendChild(container);

                mapState.animatedElements.push(container);
            });
        });
    });
}

function renderCustomMarker(marker: CustomMarker | null | undefined, worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement) {
    if (!marker) return;

    if (!WorldspaceUtils.isSameWorldspace(marker.worldspace, worldspaceID)) {
        return;
    }

    const pos = MapViewport.gameToMapCoords(marker.x, marker.y, 0, bounds);
    const container = createMarkerContainer('customMarker', 'Custom Marker', pos);
    container.classList.add('custom-marker');

    const img = document.createElement('img');
    img.src = ThemeEngine.getMarkerIconUrl(MARKER_ICON_CUSTOM_MARKER);

    const tag = createMarkerTag('Custom Marker');

    container.appendChild(img);
    container.appendChild(tag);
    questLayer.appendChild(container);
    mapState.animatedElements.push(container);
}

function renderPowerArmor(pa: PowerArmorMarker | null | undefined, worldspaceID: number, bounds: GameBounds, questLayer: HTMLElement) {
    if (!pa) return;

    if (!WorldspaceUtils.isSameWorldspace(pa.worldspace, worldspaceID)) {
        return;
    }

    const pos = MapViewport.gameToMapCoords(pa.x, pa.y, pa.z ?? 0, bounds);
    const container = createMarkerContainer('powerarmor', 'Power Armor', pos);
    container.classList.add('power-armor-marker');

    const img = document.createElement('img');
    img.src = ThemeEngine.getMarkerIconUrl(MARKER_ICON_POWER_ARMOR);

    if (mapState.player.active) {
        const zThreshold = 500;
        const zDelta = (pa.z ?? 0) - mapState.player.z;

        if (Math.abs(zDelta) > zThreshold) {
            const arrowImg = document.createElement('img');
            arrowImg.className = 'altitude-arrow';
            arrowImg.src = zDelta > 0 ? 'assets/icons/default/quest-altitude-up.svg' : 'assets/icons/default/quest-altitude-down.svg';
            container.appendChild(arrowImg);
        }
    }

    const tag = createMarkerTag('Power Armor');

    container.appendChild(img);
    container.appendChild(tag);
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

function createMarkerTag(text: string): HTMLSpanElement {
    const tag = document.createElement('span');
    tag.className = 'marker-nametag';
    tag.textContent = text;
    return tag;
}
