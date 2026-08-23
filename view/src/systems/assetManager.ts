import { ENGINE_MARKER_TYPES, DEFAULT_BLANK_CONFIG } from '@/core/constants.js';

export const AssetManager = {
    getMapTextureUrl(worldspaceEditorID?: string): string {
        if (worldspaceEditorID) {
            return `assets/maps/${worldspaceEditorID}/default.png`;
        }
        return DEFAULT_BLANK_CONFIG.texturePath;
    },

    getLocationIconUrl(engineType: number, discovered?: boolean, customIcon?: string): string {
        if (customIcon) {
            if (!discovered) {
                return `assets/icons/location/${customIcon}_undiscovered.svg`;
            }
            return `assets/icons/location/${customIcon}.svg`;
        }

        const semanticName = ENGINE_MARKER_TYPES[engineType] || 'default';

        if (!discovered && engineType < 81) {
            return `assets/icons/location/${semanticName}_undiscovered.svg`;
        }

        return `assets/icons/location/${semanticName}.svg`;
    },

    getQuestMarkerIconUrl(isDoor: boolean, isActive: boolean): string {
        const semanticName = isDoor ? 'quest-door' : 'quest';
        
        if (!isActive) {
            return `assets/icons/${semanticName}_inactive.svg`;
        }
        
        return `assets/icons/${semanticName}.svg`;
    },

    getIconUrl(iconName: string): string {
        return `assets/icons/${iconName}.svg`;
    }
};
