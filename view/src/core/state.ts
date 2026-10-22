import { MapConfig } from '@/types/map.js';
import { F4SEMapPayload } from '@/types/payloads.js';

export const mapState = {
    activeMapConfig: {
        mapName: "Commonwealth",
        worldspaceID: 60,
        texturePath: "assets/maps/commonwealth/default.png",
        gutters: {
            left: 0.02685546875,
            right: 0.0283203125,
            top: 0.02685546875,
            bottom: 0.0283203125
        }
    } as MapConfig,

    player: {
        x: 0,
        y: 0,
        z: 0,
        angle: 0,
        active: false
    },

    selectedWorldspaceID: null as number | null,
    lastPayload: null as F4SEMapPayload | null,
};
