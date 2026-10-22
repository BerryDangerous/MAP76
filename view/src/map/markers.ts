import { GameBounds, PlayerData, MapPosition, MapConfig, MapGutters, CellBoundsOverride } from '@/types/map.js';
import { CustomMarker, POIMarker, PowerArmorMarker, MarkerType } from '@/types/markers.js';
import { SettlementData, GatewayMarker } from '@/types/payloads.js';
import { QuestItem } from '@/types/quests.js';

import { 
    ASSET_ICON_CUSTOM_MARKER, 
    ASSET_ICON_POWER_ARMOR, 
    ASSET_ICON_PLAYER_LOCATION, 
    MARKER_ICON_RAIDER_OUTPOST, 
    MARKER_ICON_VASSAL_SETTLEMENT, 
    MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT, 
    NAKANO_RESIDENCE_REAL_MARKER, 
    NAKANO_RESIDENCE_FAKE_MARKER, 
    NUKA_WORLD_MAP_GUTTERS, 
    FAR_HARBOR_MAP_GUTTERS, 
    DEFAULT_MAP_GUTTERS 
} from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';
import { domainState, PlayerState } from '@/core/state/index.js';
import { isSameWorldspace, getEffectiveWorldspaceBounds } from '@/core/state/worldspaces.js';

import { AssetManager } from '@/systems/assetManager.js';

import { viewportState } from '@/map/viewportState.js';
import { gameToMapCoords } from '@/map/coordinates.js';
import { resolveGatewayTarget } from '@/map/gateways.js';
import { isSupplyLinesViewActive, activeGatewayMarkerFormIds } from '@/map/supplyLines.js';

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
    settlements: Map<number, SettlementData>,
    markers: Map<number, POIMarker>,
    vassalDistance?: number
): Set<number> {
    const potentialFormIds = new Set<number>();
    if (!settlements || !markers || !vassalDistance) {
        return potentialFormIds;
    }

    const vassalDistSq = vassalDistance * vassalDistance;

    let raiderSettlement: SettlementData | undefined;
    for (const s of settlements.values()) {
        if (s.raider && (s.markerFormId === outpostMarkerFormId || s.formId === outpostMarkerFormId || s.locationFormId === outpostMarkerFormId)) {
            raiderSettlement = s;
            break;
        }
    }
    if (!raiderSettlement) return potentialFormIds;

    const outpostMarker = markers.get(raiderSettlement.markerFormId);
    if (!outpostMarker) return potentialFormIds;

    for (const s of settlements.values()) {
        if (s.raider || s.vassal || s.excludedFromVassal) continue;

        const sMarker = markers.get(s.markerFormId);
        if (!sMarker) continue;

        if (!isSameWorldspace(sMarker.worldspace, outpostMarker.worldspace)) continue;

        const dx = sMarker.x - outpostMarker.x;
        const dy = sMarker.y - outpostMarker.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= vassalDistSq) {
            potentialFormIds.add(sMarker.formId);
        }
    }

    return potentialFormIds;
}

export function renderPlayer(
    player: PlayerData | PlayerState | undefined, 
    worldspaceID: number, 
    bounds: GameBounds,
    gutters: MapGutters,
    cellBounds?: CellBoundsOverride
): void {
    domainState.updatePlayer({ active: false });
    if (!player || player.worldspace === undefined || !isSameWorldspace(player.worldspace, worldspaceID)) return;

    const pos = gameToMapCoords(player.x, player.y, player.z, bounds, gutters, cellBounds);
    const pImg = document.createElement('div');
    pImg.id = 'player-marker';
    pImg.className = 'player-marker-vector';
    pImg.innerHTML = AssetManager.getIconSvg(ASSET_ICON_PLAYER_LOCATION);
    pImg.style.left = `${pos.x}%`;
    pImg.style.top = `${pos.y}%`;

    domainState.updatePlayer({
        x: player.x,
        y: player.y,
        z: player.z,
        angle: player.angle,
        active: true
    });

    getPlayerLayer()?.appendChild(pImg);
    viewportState.animatedElements.push(pImg);
}

export function renderLocationMarkers(
    markers: POIMarker[], 
    worldspaceID: number, 
    bounds: GameBounds,
    gutters: MapGutters,
    cellBounds?: CellBoundsOverride
): void {
    const markerLayer = getMarkerLayer();
    if (!markerLayer) return;

    const realNakano = markers.find(m => m.pluginName === NAKANO_RESIDENCE_REAL_MARKER.plugin && m.localFormId === NAKANO_RESIDENCE_REAL_MARKER.localFormId);

    markers.forEach(m => {
        if (!isSameWorldspace(m.worldspace, worldspaceID)) return;

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

        const effectiveBounds = getEffectiveWorldspaceBounds(bounds, cellBounds);
        const isClamped = (x < effectiveBounds.minX || x > effectiveBounds.maxX || y < effectiveBounds.minY || y > effectiveBounds.maxY);

        if (isClamped) {
            x = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, x));
            y = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, y));
        }

        const pos = gameToMapCoords(x, y, 0, bounds, gutters, cellBounds);
        const container = createMarkerContainer('location', m.name, pos);
        if (isClamped) {
            container.classList.add('clamped-marker');
        }

        container.dataset.formId = m.formId.toString();

        let isOwnedWorkshop = false;
        let isRaiderOutpost = false;
        let isVassal = false;
        for (const w of domainState.settlements.values()) {
            if (w.markerFormId === m.formId || w.formId === m.formId || w.locationFormId === m.formId) {
                if (w.owned) isOwnedWorkshop = true;
                if (w.raider) isRaiderOutpost = true;
                if (w.vassal) isVassal = true;
            }
        }

        container.dataset.isOwnedWorkshop = isOwnedWorkshop ? 'true' : 'false';

        const iconType = isRaiderOutpost ? MARKER_ICON_RAIDER_OUTPOST :
                         isVassal ? MARKER_ICON_VASSAL_SETTLEMENT :
                         m.type;

        const defaultIconSvg = AssetManager.getLocationIconSvg(iconType, (m.discovered || m.canFastTravel), m.customIcon);
        const shadowedDefaultIconSvg = defaultIconSvg.replace(/<svg\s+/, '<svg class="marker-shadow" ') + defaultIconSvg;
        container.dataset.defaultIconSvg = shadowedDefaultIconSvg;

        const potentialVassalIconSvg = AssetManager.getLocationIconSvg(MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT, (m.discovered || m.canFastTravel), m.customIcon);
        const shadowedPotentialVassalIconSvg = potentialVassalIconSvg.replace(/<svg\s+/, '<svg class="marker-shadow" ') + potentialVassalIconSvg;
        container.dataset.potentialVassalIconSvg = shadowedPotentialVassalIconSvg;
        container.dataset.isRaiderOutpost = isRaiderOutpost ? 'true' : 'false';

        container.innerHTML = shadowedDefaultIconSvg;
        container.dataset.canFastTravel = m.canFastTravel.toString();

        markerLayer.appendChild(container);
    });
}

export function renderQuestMarkers(
    quests: QuestItem[], 
    worldspaceID: number, 
    bounds: GameBounds, 
    questLayer: HTMLElement,
    gutters: MapGutters,
    gateways?: Record<number, Record<number, GatewayMarker[]>>,
    cellBounds?: CellBoundsOverride
): void {
    if (!quests) return;

    quests.forEach(quest => {
        if (!quest.objectives) return;
        if (appSettings.hideInactiveQuestMarkers && !quest.isTracked) return;

        quest.objectives.forEach(objective => {
            if (objective.state !== 1) return;
            if (!objective.targets) return;

            const markerTooltipText = objective.text ? objective.text : quest.questName;

            objective.targets.forEach(target => {
                const refX = domainState.player.active ? domainState.player.x : 0;
                const refY = domainState.player.active ? domainState.player.y : 0;
                
                const resolved = resolveGatewayTarget(
                    target.worldspace,
                    worldspaceID,
                    target.x,
                    target.y,
                    target.z,
                    refX,
                    refY,
                    gateways,
                    domainState.markers
                );

                if (!resolved) return;

                let gx = resolved.x;
                let gy = resolved.y;

                const effectiveBounds = getEffectiveWorldspaceBounds(bounds, cellBounds);
                const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

                if (resolved.isGateway || isClamped) {
                    gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
                    gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
                }

                const pos = gameToMapCoords(gx, gy, resolved.z, bounds, gutters, cellBounds);

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
                viewportState.animatedElements.push(container);
            });
        });
    });
}

export function renderCustomMarker(
    marker: CustomMarker | null | undefined, 
    worldspaceID: number, 
    bounds: GameBounds, 
    questLayer: HTMLElement,
    gutters: MapGutters,
    gateways?: Record<number, Record<number, GatewayMarker[]>>,
    cellBounds?: CellBoundsOverride
): void {
    if (!marker) return;

    const refX = domainState.player.active ? domainState.player.x : 0;
    const refY = domainState.player.active ? domainState.player.y : 0;

    const resolved = resolveGatewayTarget(
        marker.worldspace,
        worldspaceID,
        marker.x,
        marker.y,
        0,
        refX,
        refY,
        gateways,
        domainState.markers
    );

    if (!resolved) return;

    let gx = resolved.x;
    let gy = resolved.y;

    const effectiveBounds = getEffectiveWorldspaceBounds(bounds, cellBounds);
    const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

    if (resolved.isGateway || isClamped) {
        gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
        gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
    }

    const pos = gameToMapCoords(gx, gy, 0, bounds, gutters, cellBounds);

    const container = createMarkerContainer('customMarker', 'Custom Marker', pos);
    if (resolved.isGateway || isClamped) {
        container.classList.add('clamped-marker');
    }
    container.classList.add('custom-marker');

    const iconSvg = AssetManager.getIconSvg(ASSET_ICON_CUSTOM_MARKER);
    const shadowSvg = iconSvg.replace(/<svg\s+/, '<svg class="marker-shadow" ');
    container.innerHTML = shadowSvg + iconSvg;

    questLayer.appendChild(container);
    viewportState.animatedElements.push(container);
}

export function renderPowerArmor(
    armor: PowerArmorMarker | null | undefined, 
    worldspaceID: number, 
    bounds: GameBounds, 
    questLayer: HTMLElement,
    gutters: MapGutters,
    gateways?: Record<number, Record<number, GatewayMarker[]>>,
    cellBounds?: CellBoundsOverride
): void {
    if (!armor) return;

    const refX = domainState.player.active ? domainState.player.x : 0;
    const refY = domainState.player.active ? domainState.player.y : 0;

    const resolved = resolveGatewayTarget(
        armor.worldspace,
        worldspaceID,
        armor.x,
        armor.y,
        armor.z ?? 0,
        refX,
        refY,
        gateways,
        domainState.markers
    );

    if (!resolved) return;

    let gx = resolved.x;
    let gy = resolved.y;

    const effectiveBounds = getEffectiveWorldspaceBounds(bounds, cellBounds);
    const isClamped = (gx < effectiveBounds.minX || gx > effectiveBounds.maxX || gy < effectiveBounds.minY || gy > effectiveBounds.maxY);

    if (resolved.isGateway || isClamped) {
        gx = Math.max(effectiveBounds.minX, Math.min(effectiveBounds.maxX, gx));
        gy = Math.max(effectiveBounds.minY, Math.min(effectiveBounds.maxY, gy));
    }

    const pos = gameToMapCoords(gx, gy, resolved.z, bounds, gutters, cellBounds);

    const container = createMarkerContainer('powerarmor', 'Power Armor', pos);
    if (resolved.isGateway || isClamped) {
        container.classList.add('clamped-marker');
    }
    container.classList.add('power-armor-marker');

    const iconSvg = AssetManager.getIconSvg(ASSET_ICON_POWER_ARMOR);
    const shadowSvg = iconSvg.replace(/<svg\s+/, '<svg class="marker-shadow" ');
    container.innerHTML = shadowSvg + iconSvg;

    questLayer.appendChild(container);
    viewportState.animatedElements.push(container);
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

export function calculateFinalGutters(config: MapConfig): MapGutters {
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
