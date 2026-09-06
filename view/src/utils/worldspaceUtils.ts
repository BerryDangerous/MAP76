import { F4SEMapPayload, GatewayMarker } from '@/types/payloads.js';

import { DLC_GATEWAYS } from '@/core/constants.js';
import { mapState } from '@/core/state.js';

export const WorldspaceUtils = {
    isSameWorldspace(ws1: number, ws2: number): boolean {
        return ws1 === ws2;
    },

    getWorldspaceName(worldspaceId?: number): string | undefined {
        if (worldspaceId === undefined) return undefined;
        const payload = mapState.lastPayload;
        if (payload && payload.worldspaces && payload.worldspaces[worldspaceId]) {
            return payload.worldspaces[worldspaceId].fullName;
        }
        return undefined;
    },

    getWorldspaceEditorID(worldspaceId?: number): string | undefined {
        if (worldspaceId === undefined) return undefined;
        const payload = mapState.lastPayload;
        if (payload && payload.worldspaces && payload.worldspaces[worldspaceId]) {
            return payload.worldspaces[worldspaceId].editorID;
        }
        return undefined;
    },

    resolveGatewayTarget(
        targetWorldspace: number,
        currentWorldspace: number,
        targetX: number,
        targetY: number,
        targetZ: number,
        refX: number,
        refY: number,
        payload: F4SEMapPayload | null,
        options?: { gatewayType?: 'door' | 'mapMarker' }
    ): { x: number; y: number; z: number; isGateway: boolean; formId?: number } | null {
        if (targetWorldspace === currentWorldspace) {
            return { x: targetX, y: targetY, z: targetZ, isGateway: false };
        }

        const gatewayType = options?.gatewayType || 'door';

        let effectiveTargetWs = targetWorldspace;
        if (payload && payload.gateways && payload.gateways[currentWorldspace]) {
            const sourceGateways = payload.gateways[currentWorldspace];
            if (!sourceGateways[targetWorldspace]) {
                const nextHop = WorldspaceUtils.findNextHop(currentWorldspace, targetWorldspace, payload);
                if (nextHop !== null) {
                    effectiveTargetWs = nextHop;
                }
            }
        }

        const currentWsEditorID = WorldspaceUtils.getWorldspaceEditorID(currentWorldspace)?.toLowerCase();
        const targetWsEditorID = WorldspaceUtils.getWorldspaceEditorID(effectiveTargetWs)?.toLowerCase();

        const getDLCGateway = (gw: { x: number, y: number, z: number, isGateway: boolean, plugin?: string, localFormId?: number }) => {
            if (gw.plugin && gw.localFormId && payload && payload.markers) {
                const marker = payload.markers.find(m => m.pluginName === gw.plugin && m.localFormId === gw.localFormId);
                if (marker) {
                    return { ...gw, formId: marker.formId };
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

        if (!payload || !payload.gateways) {
            return null;
        }

        const sourceGateways = payload.gateways[currentWorldspace];
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
    },

    findNextHop(
        currentWorldspace: number,
        targetWorldspace: number,
        payload: F4SEMapPayload
    ): number | null {
        if (!payload.gateways) return null;

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

            const edges = payload.gateways[current];
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
};
