import { GatewayMarker } from '@/types/payloads.js';
import { POIMarker } from '@/types/markers.js';

import { DLC_GATEWAYS } from '@/core/constants.js';
import { getWorldspaceEditorID } from '@/core/state/worldspaces.js';

export function resolveGatewayTarget(
    targetWorldspace: number,
    currentWorldspace: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    refX: number,
    refY: number,
    gateways?: Record<number, Record<number, GatewayMarker[]>>,
    markers?: Map<number, POIMarker> | POIMarker[],
    options?: { gatewayType?: 'door' | 'mapMarker' }
): { x: number; y: number; z: number; isGateway: boolean; formId?: number } | null {
    if (targetWorldspace === currentWorldspace) {
        return { x: targetX, y: targetY, z: targetZ, isGateway: false };
    }

    const gatewayType = options?.gatewayType || 'door';

    let effectiveTargetWs = targetWorldspace;
    if (gateways && gateways[currentWorldspace]) {
        const sourceGateways = gateways[currentWorldspace];
        if (!sourceGateways[targetWorldspace]) {
            const nextHop = findNextHopGateway(currentWorldspace, targetWorldspace, gateways);
            if (nextHop !== null) {
                effectiveTargetWs = nextHop;
            }
        }
    }

    const currentWsEditorID = getWorldspaceEditorID(currentWorldspace)?.toLowerCase();
    const targetWsEditorID = getWorldspaceEditorID(effectiveTargetWs)?.toLowerCase();

    const getDLCGateway = (gw: { x: number, y: number, z: number, isGateway: boolean, plugin?: string, localFormId?: number }) => {
        if (gw.plugin && gw.localFormId && markers) {
            if (markers instanceof Map) {
                for (const marker of markers.values()) {
                    if (marker.pluginName === gw.plugin && marker.localFormId === gw.localFormId) {
                        return { ...gw, formId: marker.formId };
                    }
                }
            } else {
                const marker = markers.find(m => m.pluginName === gw.plugin && m.localFormId === gw.localFormId);
                if (marker) {
                    return { ...gw, formId: marker.formId };
                }
            }
        }
        return gw;
    };

    if (currentWsEditorID === DLC_GATEWAYS.COMMONWEALTH_ID.toLowerCase() && targetWsEditorID === DLC_GATEWAYS.NUKA_WORLD_ID.toLowerCase()) {
        return getDLCGateway(DLC_GATEWAYS.COMMONWEALTH_TO_NUKAWORLD[gatewayType]);
    }
    if (currentWsEditorID === DLC_GATEWAYS.NUKA_WORLD_ID.toLowerCase() && targetWsEditorID === DLC_GATEWAYS.COMMONWEALTH_ID.toLowerCase()) {
        return getDLCGateway(DLC_GATEWAYS.NUKAWORLD_TO_COMMONWEALTH[gatewayType]);
    }
    if (currentWsEditorID === DLC_GATEWAYS.COMMONWEALTH_ID.toLowerCase() && targetWsEditorID === DLC_GATEWAYS.FAR_HARBOR_ID.toLowerCase()) {
        return getDLCGateway(DLC_GATEWAYS.COMMONWEALTH_TO_FARHARBOR[gatewayType]);
    }
    if (currentWsEditorID === DLC_GATEWAYS.FAR_HARBOR_ID.toLowerCase() && targetWsEditorID === DLC_GATEWAYS.COMMONWEALTH_ID.toLowerCase()) {
        return getDLCGateway(DLC_GATEWAYS.FARHARBOR_TO_COMMONWEALTH[gatewayType]);
    }

    if (!gateways) {
        return null;
    }

    const sourceGateways = gateways[currentWorldspace];
    if (!sourceGateways) {
        return null;
    }

    let gatewaysToTarget = sourceGateways[effectiveTargetWs];
    if (!gatewaysToTarget || gatewaysToTarget.length === 0) {
        return null;
    }

    let closestGateway: GatewayMarker | null = null;
    let minDistanceSq = Infinity;

    for (const gw of gatewaysToTarget) {
        const dx = gw.x - refX;
        const dy = gw.y - refY;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestGateway = gw;
        }
    }

    if (closestGateway) {
        return { x: closestGateway.x, y: closestGateway.y, z: 0, isGateway: true };
    }

    return null;
}

export function findNextHopGateway(
    currentWorldspace: number,
    targetWorldspace: number,
    gateways?: Record<number, Record<number, GatewayMarker[]>>
): number | null {
    if (!gateways) return null;

    const queue: number[] = [currentWorldspace];
    const visited = new Set<number>();
    visited.add(currentWorldspace);

    const parentMap = new Map<number, number>();

    while (queue.length > 0) {
        const current = queue.shift()!;
        
        if (current === targetWorldspace) {
            let step = current;
            while (parentMap.get(step) !== currentWorldspace) {
                step = parentMap.get(step)!;
            }
            return step;
        }

        const edges = gateways[current];
        if (edges) {
            for (const neighborStr of Object.keys(edges)) {
                const neighbor = parseInt(neighborStr, 10);
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parentMap.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }
    }

    return null;
}
