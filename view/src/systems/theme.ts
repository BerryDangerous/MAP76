import { ENGINE_MARKER_TYPES } from '../core/constants.js';
import { mapState } from '../core/state.js';

export const ThemeEngine = {

    initMapConfig() {
        const globalConfig = window.DEFAULT_COMMONWEALTH_CONFIG;
        if (globalConfig) {
            mapState.activeMapConfig = globalConfig;
            console.log(`[Theme] Overrode layout using global config: ${globalConfig.mapName}`);
        } else {
            console.log('[Theme] Using built-in hardcoded map configuration fallback.');
        }
    },

    getMarkerIconUrl(engineType: number, discovered?: boolean, customIcon?: string): string {
        const activeTheme = mapState.currentTheme;

        if (customIcon) {
            return `assets/icons/${activeTheme}/custom/${customIcon}.svg`;
        }

        const semanticName = ENGINE_MARKER_TYPES[engineType] || 'default';

        if (!discovered && engineType < 81) {
            return `assets/icons/${activeTheme}/${semanticName}_undiscovered.svg`;
        }

        return `assets/icons/${activeTheme}/${semanticName}.svg`;
    },

    getPlayerIconUrl(): string {
        return `assets/icons/${mapState.currentTheme}/player-location.svg`;
    }
};
