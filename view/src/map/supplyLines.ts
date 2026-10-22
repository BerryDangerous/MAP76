import { MapConfig, MapGutters, CellBoundsOverride } from '@/types/map.js';
import { F4SEMapPayload, GatewayMarker } from '@/types/payloads.js';

import { domainState } from '@/core/state/index.js';
import { getEffectiveWorldspaceBounds } from '@/core/state/worldspaces.js';

import { gameToMapCoords } from '@/map/coordinates.js';
import { resolveGatewayTarget } from '@/map/gateways.js';

let isSupplyLinesActiveState = false;
let svgLayer: SVGSVGElement | null = null;
export const activeGatewayMarkerFormIds = new Set<number>();

export function isSupplyLinesViewActive(): boolean {
    return isSupplyLinesActiveState;
}

export function setSupplyLinesViewActive(active: boolean): void {
    isSupplyLinesActiveState = active;
    if (svgLayer) {
        if (active) {
            svgLayer.classList.add('is-active');
        } else {
            svgLayer.classList.remove('is-active');
        }
    }
}

export function toggleSupplyLinesView(): boolean {
    setSupplyLinesViewActive(!isSupplyLinesActiveState);
    return isSupplyLinesActiveState;
}

export function initSupplyLinesLayer(): SVGSVGElement | null {
    const viewport = document.getElementById('map-viewport');
    const markerLayer = document.getElementById('marker-layer');
    if (!viewport || !markerLayer) return null;

    let layer = document.getElementById('supply-lines-layer') as unknown as SVGSVGElement;
    if (!layer) {
        layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        layer.id = 'supply-lines-layer';

        viewport.insertBefore(layer, markerLayer);
    }

    svgLayer = layer;
    return svgLayer;
}

export function hasSupplyLines(): boolean {
    for (const ws of domainState.settlements.values()) {
        if (ws.owned && ws.linkedLocationFormIds && ws.linkedLocationFormIds.length > 0) {
            return true;
        }
    }
    return false;
}

function resolveCrossWorldspaceGateway(
    targetWorldspace: number,
    currentWorldspace: number,
    refX: number,
    refY: number,
    gutters: MapGutters,
    gateways?: Record<number, Record<number, GatewayMarker[]>>,
    cellBounds?: CellBoundsOverride
): { x: number; y: number } {
    const bounds = domainState.worldspaces.get(currentWorldspace)?.bounds;
    if (!bounds) return { x: 0, y: 0 };
    
    const resolved = resolveGatewayTarget(
        targetWorldspace,
        currentWorldspace,
        { x: 0, y: 0, z: 0 },
        { x: refX, y: refY },
        gateways,
        domainState.markers,
        { gatewayType: 'mapMarker' }
    );
    
    if (resolved && resolved.isGateway) {
        if (resolved.formId) {
            activeGatewayMarkerFormIds.add(resolved.formId);
        }

        let gx = resolved.x;
        let gy = resolved.y;

        const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = getEffectiveWorldspaceBounds(bounds, cellBounds);
        gx = Math.max(bMinX, Math.min(bMaxX, gx));
        gy = Math.max(bMinY, Math.min(bMaxY, gy));

        const gwPos = gameToMapCoords(gx, gy, 0, bounds, gutters, cellBounds);
        return { x: gwPos.x, y: gwPos.y };
    }
    
    const gwPos = gameToMapCoords(0, 0, 0, bounds, gutters, cellBounds);
    return { x: gwPos.x, y: gwPos.y };
}

export function renderSupplyLines(payload?: F4SEMapPayload | null, config?: MapConfig): void {
    if (!svgLayer) {
        initSupplyLinesLayer();
    }

    if (!svgLayer) return;

    svgLayer.innerHTML = '';

    const currentWorldspace = config?.worldspaceID ?? domainState.getActiveWorldspaceID();
    const bounds = domainState.worldspaces.get(currentWorldspace)?.bounds;
    if (!bounds) return;

    const gutters = config?.gutters ?? { left: 0, right: 0, top: 0, bottom: 0 };
    const cellBounds = config?.cellBounds;

    const settlements = domainState.settlements;
    const markers = domainState.markers;
    const gateways = payload?.gateways;

    if (settlements.size === 0 || markers.size === 0) {
        return;
    }

    activeGatewayMarkerFormIds.clear();

    const coordsMap = new Map<number, { x: number; y: number }>();
    const rawCoordsMap = new Map<number, { x: number; y: number }>();

    for (const ws of settlements.values()) {
        if (ws.worldspace !== currentWorldspace) continue;
        const marker = ws.markerFormId ? markers.get(ws.markerFormId) : (markers.get(ws.formId) || null);
        if (marker) {
            const pos = gameToMapCoords(marker.x, marker.y, 0, bounds, gutters, cellBounds);
            coordsMap.set(ws.locationFormId, { x: pos.x, y: pos.y });
            coordsMap.set(ws.formId, { x: pos.x, y: pos.y });
            rawCoordsMap.set(ws.locationFormId, { x: marker.x, y: marker.y });
            rawCoordsMap.set(ws.formId, { x: marker.x, y: marker.y });
            if (ws.markerFormId) {
                coordsMap.set(ws.markerFormId, { x: pos.x, y: pos.y });
                rawCoordsMap.set(ws.markerFormId, { x: marker.x, y: marker.y });
            }
        }
    }

    const drawnPairs = new Set<string>();

    for (const ws of settlements.values()) {
        if (!ws.owned || !ws.linkedLocationFormIds || ws.linkedLocationFormIds.length === 0) {
            continue;
        }

        let srcPos = coordsMap.get(ws.locationFormId) || coordsMap.get(ws.formId);
        let rawSrcPos = rawCoordsMap.get(ws.locationFormId) || rawCoordsMap.get(ws.formId);
        if (!srcPos && ws.markerFormId) {
            srcPos = coordsMap.get(ws.markerFormId);
            rawSrcPos = rawCoordsMap.get(ws.markerFormId);
        }

        ws.linkedLocationFormIds.forEach(targetId => {
            let destPos = coordsMap.get(targetId);
            let rawDestPos = rawCoordsMap.get(targetId);

            let targetWs: typeof ws | undefined;
            for (const s of settlements.values()) {
                if (s.locationFormId === targetId || s.formId === targetId || s.markerFormId === targetId) {
                    targetWs = s;
                    break;
                }
            }

            if (!destPos && srcPos && rawSrcPos) {
                if (targetWs && targetWs.worldspace && targetWs.worldspace !== currentWorldspace) {
                    destPos = resolveCrossWorldspaceGateway(
                        targetWs.worldspace,
                        currentWorldspace,
                        rawSrcPos.x,
                        rawSrcPos.y,
                        gutters,
                        gateways,
                        cellBounds
                    );
                }
            } else if (!srcPos && !destPos) {
                if (ws.worldspace && targetWs && targetWs.worldspace && ws.worldspace !== currentWorldspace && targetWs.worldspace !== currentWorldspace && ws.worldspace !== targetWs.worldspace) {
                    srcPos = resolveCrossWorldspaceGateway(ws.worldspace, currentWorldspace, 0, 0, gutters, gateways, cellBounds);
                    destPos = resolveCrossWorldspaceGateway(targetWs.worldspace, currentWorldspace, 0, 0, gutters, gateways, cellBounds);
                }
            }

            const finalSrc = srcPos;
            const finalDest = destPos;

            if (!finalSrc || !finalDest || (finalSrc.x === finalDest.x && finalSrc.y === finalDest.y)) {
                return;
            }

            const pairKey = [ws.locationFormId, targetId].sort().join('-');
            if (drawnPairs.has(pairKey)) return;
            drawnPairs.add(pairKey);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', `${finalSrc.x}%`);
            line.setAttribute('y1', `${finalSrc.y}%`);
            line.setAttribute('x2', `${finalDest.x}%`);
            line.setAttribute('y2', `${finalDest.y}%`);
            line.classList.add('supply-line');

            svgLayer!.appendChild(line);
        });
    }
}
