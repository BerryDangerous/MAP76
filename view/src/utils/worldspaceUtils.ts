import { mapState } from '../core/state.js';
import { FORM_ID_INDEX_MASK } from '../core/constants.js';

export const WorldspaceUtils = {
    isSameWorldspace(ws1: number, ws2: number): boolean {
        return (ws1 & FORM_ID_INDEX_MASK) === (ws2 & FORM_ID_INDEX_MASK);
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
    }
};
