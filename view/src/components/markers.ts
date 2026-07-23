import { mapState } from '../core/state.js';
import { ThemeEngine } from '../systems/theme.js';
import { GameBounds, PlayerData, MapPosition } from '../types/map.js';
import { CustomMarker, POIMarker, PowerArmorMarker, MarkerType } from '../types/markers.js';
import { F4SEMapPayload } from '../types/payloads.js';
import { QuestItem } from '../types/quests.js';
import { MapViewport } from './viewport.js';
import { MARKER_ICON_QUEST_TARGET, MARKER_ICON_QUEST_DOOR, MARKER_ICON_CUSTOM_MARKER, MARKER_ICON_POWER_ARMOR } from '../core/constants.js';
import { isSameWorldspace } from '../utils/worldspace.js';

function getPlayerLayer(): HTMLElement | null {
    return document.getElementById('player-layer');
}

function getMarkerLayer(): HTMLElement | null {
    return document.getElementById('marker-layer');
}

export function loadMarkers(payload: F4SEMapPayload) {
    if (!payload) return;

    if (payload.player && payload.player.worldspace !== undefined) {
        ThemeEngine.updateWorldspaceConfig(payload.player.worldspace, payload.player.worldspaceEditorID);
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
    renderLocationMarkers(payload.markers, config.worldspaceID, bounds);
    if (questLayer) {
        renderQuestMarkers(payload.quests, config.worldspaceID, bounds, questLayer);
        renderCustomMarker(payload.custom_marker, config.worldspaceID, bounds, questLayer);
        renderPowerArmor(payload.power_armor, config.worldspaceID, bounds, questLayer);
    }

    MapViewport.updateViewportTransform();
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

function renderPlayer(player: PlayerData | undefined, worldspaceID: number, bounds: GameBounds) {
    mapState.player.active = false;
    if (!player || !isSameWorldspace(player.worldspace, worldspaceID)) return;

    const pos = MapViewport.gameToMapCoords(player.x, player.y, player.z, bounds);
    const pImg = document.createElement('img');
    pImg.id = 'player-marker';
    pImg.className = 'player-marker-vector';
    pImg.src = ThemeEngine.getPlayerIconUrl();
    pImg.style.left = `${pos.x}%`;
    pImg.style.top = `${pos.y}%`;

    mapState.player.x = pos.x;
    mapState.player.y = pos.y;
    mapState.player.z = pos.z;
    mapState.player.angle = player.angle;
    mapState.player.active = true;

    getPlayerLayer()?.appendChild(pImg);
    mapState.animatedElements.push(pImg);
}

function renderLocationMarkers(markers: POIMarker[], worldspaceID: number, bounds: GameBounds) {
    const markerLayer = getMarkerLayer();
    if (!markerLayer) return;

    const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = MapViewport.getEffectiveBounds(bounds);

    markers.forEach(m => {
        if (!isSameWorldspace(m.worldspace, worldspaceID)) return;

        const shouldRender = m.visible || m.discovered || m.canFastTravel;
        if (!shouldRender) return;

        let x = m.x;
        let y = m.y;
        const isClamped = (x < bMinX || x > bMaxX || y < bMinY || y > bMaxY);

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

        const img = document.createElement('img');
        img.src = ThemeEngine.getMarkerIconUrl(m.type, (m.discovered || m.canFastTravel), m.customIcon);
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
            if (objective.status !== 1) return;
            if (!objective.targets) return;

            const markerTooltipText = objective.text ? objective.text : quest.questName;

            objective.targets.forEach(target => {
                if (!isSameWorldspace(target.worldspace, worldspaceID)) return;

                const pos = MapViewport.gameToMapCoords(target.x, target.y, target.z, bounds);

                const container = createMarkerContainer('quest', markerTooltipText, pos);
                container.classList.add('quest-marker');

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

    if (!isSameWorldspace(marker.worldspace, worldspaceID)) {
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

    if (!isSameWorldspace(pa.worldspace, worldspaceID)) {
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
