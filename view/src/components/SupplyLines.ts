import { F4SEMapPayload, SettlementData } from '@/types/payloads.js';

import { mapState } from '@/core/state.js';

import { MapUtils } from '@/utils/mapUtils.js';
import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

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
    const payload = mapState.lastPayload;
    if (!payload || !payload.settlements) return false;
    return payload.settlements.some(ws => ws.owned && ws.linkedLocationFormIds && ws.linkedLocationFormIds.length > 0);
}

function resolveCrossWorldspaceGateway(
    targetWorldspace: number,
    currentWorldspace: number,
    refX: number,
    refY: number,
    payload: F4SEMapPayload
): { x: number; y: number } {
    const bounds = payload.worldspaces?.[currentWorldspace]?.bounds;
    if (!bounds) return { x: 0, y: 0 };
    const markers = payload.markers;
    
    const resolved = WorldspaceUtils.resolveGatewayTarget(
        targetWorldspace,
        currentWorldspace,
        0, 0, 0,
        refX, refY,
        payload,
        { gatewayType: 'mapMarker' }
    );
    
    if (resolved && resolved.isGateway) {
        if (resolved.formId) {
            activeGatewayMarkerFormIds.add(resolved.formId);
        }

        let gx = resolved.x;
        let gy = resolved.y;

        const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = MapUtils.getEffectiveBounds(bounds);
        gx = Math.max(bMinX, Math.min(bMaxX, gx));
        gy = Math.max(bMinY, Math.min(bMaxY, gy));

        const gwPos = MapUtils.gameToMapCoords(gx, gy, 0, bounds, mapState.activeMapConfig!.gutters!);
        return { x: gwPos.x, y: gwPos.y };
    }
    
    const gwPos = MapUtils.gameToMapCoords(0, 0, 0, bounds, mapState.activeMapConfig!.gutters!);
    return { x: gwPos.x, y: gwPos.y };
}

export function renderSupplyLines(payload: F4SEMapPayload): void {
    if (!svgLayer) {
        initSupplyLinesLayer();
    }

    if (!svgLayer) return;

    svgLayer.innerHTML = '';

    if (!payload || !payload.settlements || !payload.markers) {
        return;
    }

    const currentWorldspace = mapState.activeMapConfig?.worldspaceID ?? 0;
    const bounds = payload.worldspaces?.[currentWorldspace]?.bounds;
    if (!bounds) return;

    const settlements = payload.settlements;
    const markers = payload.markers;

    activeGatewayMarkerFormIds.clear();

    const coordsMap = new Map<number, { x: number; y: number }>();
    const rawCoordsMap = new Map<number, { x: number; y: number }>();

    settlements.forEach(ws => {
        if (ws.worldspace !== currentWorldspace) return;
        let marker = markers.find(m => m.formId === ws.markerFormId || m.formId === ws.formId);
        if (marker) {
            const pos = MapUtils.gameToMapCoords(marker.x, marker.y, 0, bounds, mapState.activeMapConfig!.gutters!);
            coordsMap.set(ws.locationFormId, { x: pos.x, y: pos.y });
            coordsMap.set(ws.formId, { x: pos.x, y: pos.y });
            rawCoordsMap.set(ws.locationFormId, { x: marker.x, y: marker.y });
            rawCoordsMap.set(ws.formId, { x: marker.x, y: marker.y });
            if (ws.markerFormId) {
                coordsMap.set(ws.markerFormId, { x: pos.x, y: pos.y });
                rawCoordsMap.set(ws.markerFormId, { x: marker.x, y: marker.y });
            }
        }
    });

    const drawnPairs = new Set<string>();

    settlements.forEach(ws => {
        if (!ws.owned || !ws.linkedLocationFormIds || ws.linkedLocationFormIds.length === 0) {
            return;
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

            if (!destPos && srcPos && rawSrcPos) {
                const targetWs = settlements.find(w => w.locationFormId === targetId || w.formId === targetId || w.markerFormId === targetId);
                if (targetWs && targetWs.worldspace && targetWs.worldspace !== currentWorldspace) {
                    destPos = resolveCrossWorldspaceGateway(
                        targetWs.worldspace,
                        currentWorldspace,
                        rawSrcPos.x,
                        rawSrcPos.y,
                        payload
                    );
                }
            } else if (!srcPos && !destPos) {
                const targetWs = settlements.find(w => w.locationFormId === targetId || w.formId === targetId || w.markerFormId === targetId);
                if (ws.worldspace && targetWs && targetWs.worldspace && ws.worldspace !== currentWorldspace && targetWs.worldspace !== currentWorldspace && ws.worldspace !== targetWs.worldspace) {
                    srcPos = resolveCrossWorldspaceGateway(ws.worldspace, currentWorldspace, 0, 0, payload);
                    destPos = resolveCrossWorldspaceGateway(targetWs.worldspace, currentWorldspace, 0, 0, payload);
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
    });
}
