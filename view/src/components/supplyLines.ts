import { F4SEMapPayload, SettlementData } from '../types/payloads.js';
import { POIMarker } from '../types/markers.js';
import { MapViewport } from './viewport.js';

let isSupplyLinesActiveState = false;
let svgLayer: SVGSVGElement | null = null;

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

export function renderSupplyLines(payload: F4SEMapPayload): void {
    if (!svgLayer) {
        initSupplyLinesLayer();
    }

    if (!svgLayer) return;

    svgLayer.innerHTML = '';

    if (!payload || !payload.settlements || !payload.bounds || !payload.markers) {
        return;
    }

    const bounds = payload.bounds;
    const settlements = payload.settlements;
    const markers = payload.markers;
    const currentWorldspace = payload.player?.worldspace || (markers.length > 0 ? markers[0].worldspace : 0);

    // Create location/marker/workshop formID to map coordinates for markers present in current map payload
    const coordsMap = new Map<number, { x: number; y: number }>();

    settlements.forEach(ws => {
        let marker = markers.find(m => m.formId === ws.markerFormId || m.formId === ws.formId);
        if (marker) {
            const pos = MapViewport.gameToMapCoords(marker.x, marker.y, 0, bounds);
            coordsMap.set(ws.locationFormId, { x: pos.x, y: pos.y });
            coordsMap.set(ws.formId, { x: pos.x, y: pos.y });
            if (ws.markerFormId) {
                coordsMap.set(ws.markerFormId, { x: pos.x, y: pos.y });
            }
        }
    });

    // Fallback gateway position for cross-worldspace links if target marker is not in current map coordinates
    const defaultGatewayPos = markers.length > 0 ? MapViewport.gameToMapCoords(markers[0].x, markers[0].y, 0, bounds) : null;

    const drawnPairs = new Set<string>();

    settlements.forEach(ws => {
        if (!ws.owned || !ws.linkedLocationFormIds || ws.linkedLocationFormIds.length === 0) {
            return;
        }

        let srcPos = coordsMap.get(ws.locationFormId) || coordsMap.get(ws.formId);
        if (!srcPos && ws.markerFormId) {
            srcPos = coordsMap.get(ws.markerFormId);
        }

        ws.linkedLocationFormIds.forEach(targetId => {
            let destPos = coordsMap.get(targetId);

            // Cross-worldspace
            if (!destPos) {
                const targetWs = settlements.find(w => w.locationFormId === targetId || w.formId === targetId || w.markerFormId === targetId);
                if (targetWs && targetWs.worldspace && targetWs.worldspace !== currentWorldspace) {
                    destPos = defaultGatewayPos || undefined;
                }
            }

            if (!srcPos && !destPos) return;

            const finalSrc = srcPos || defaultGatewayPos;
            const finalDest = destPos || defaultGatewayPos;

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
