import { ENGINE_MARKER_TYPES, WORLDSPACE_CONFIGS, DEFAULT_BLANK_CONFIG } from '../core/constants.js';
import { mapState } from '../core/state.js';
import { appSettings } from '../core/settings.js';

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

    updateWorldspaceConfig(worldspaceID: number, worldspaceEditorID?: string) {
        const editorKey = worldspaceEditorID ? worldspaceEditorID.toLowerCase() : "";
        let matchedConfig = null;
        if (worldspaceEditorID) {
            for (const key in WORLDSPACE_CONFIGS) {
                if (key.toLowerCase() === editorKey) {
                    matchedConfig = WORLDSPACE_CONFIGS[key];
                    break;
                }
            }
        }

        if (matchedConfig) {
            mapState.activeMapConfig = {
                worldspaceID: worldspaceID,
                mapName: matchedConfig.mapName,
                texturePath: matchedConfig.texturePath,
                gutters: matchedConfig.gutters
            };
        } else {
            const dynamicPath = worldspaceEditorID ? `assets/maps/${worldspaceEditorID}/default.png` : DEFAULT_BLANK_CONFIG.texturePath;
            mapState.activeMapConfig = {
                ...DEFAULT_BLANK_CONFIG,
                mapName: worldspaceEditorID || "Custom Worldspace",
                worldspaceID: worldspaceID,
                texturePath: dynamicPath
            };
        }

        const mapBg = document.getElementById('map-bg') as HTMLImageElement;
        if (mapBg) {
            mapBg.onerror = () => {
                console.warn(`[Theme] Map texture failed to load: ${mapState.activeMapConfig.texturePath}. Falling back to blank map canvas.`);
                mapBg.onerror = null;
                mapBg.src = DEFAULT_BLANK_CONFIG.texturePath;
                mapState.activeMapConfig.gutters = DEFAULT_BLANK_CONFIG.gutters;
            };
            if (mapBg.getAttribute('src') !== mapState.activeMapConfig.texturePath) {
                mapBg.src = mapState.activeMapConfig.texturePath;
            }
        }
    },

    getMarkerIconUrl(engineType: number, discovered?: boolean, customIcon?: string): string {
        const activeTheme = appSettings.iconTheme;

        if (customIcon) {
            return `assets/icons/${activeTheme}/custom/${customIcon}.svg`;
        }

        const semanticName = ENGINE_MARKER_TYPES[engineType] || 'default';

        if (!discovered && engineType < 81) {
            return `assets/icons/${activeTheme}/${semanticName}_undiscovered.svg`;
        }

        return `assets/icons/${activeTheme}/${semanticName}.svg`;
    },

    getQuestMarkerIconUrl(isDoor: boolean, isActive: boolean): string {
        const activeTheme = appSettings.iconTheme;
        const semanticName = isDoor ? 'quest-door' : 'quest';
        
        if (!isActive) {
            return `assets/icons/${activeTheme}/${semanticName}_inactive.svg`;
        }
        
        return `assets/icons/${activeTheme}/${semanticName}.svg`;
    },

    getAssetIconUrl(iconName: string): string {
        const activeTheme = appSettings.iconTheme;
        return `assets/icons/${activeTheme}/${iconName}.svg`;
    },

    getPlayerIconUrl(): string {
        return `assets/icons/${appSettings.iconTheme}/player-location.svg`;
    }
};
