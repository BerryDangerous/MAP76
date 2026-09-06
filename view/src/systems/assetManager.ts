import { AssetPayload, MapConfig } from '@/types/map.js';
import { ENGINE_MARKER_TYPES, DEFAULT_BLANK_CONFIG } from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';

export const AssetManager = {
    mapConfigs: {} as Record<string, MapConfig>,
    assetCache: {} as Record<string, string>,
    imageCache: new Map<string, HTMLImageElement>(),

    init(payload: AssetPayload) {
        this.mapConfigs = payload.mapConfigs || {};
        
        for (const [key, config] of Object.entries(this.mapConfigs)) {
            config.configID = key;
        }

        this.assetCache = payload.assetCache || {};
        console.log(`[AssetManager] Loaded ${Object.keys(this.mapConfigs).length} map configs and ${Object.keys(this.assetCache).length} cached assets.`);
        
        this.preloadDiscoveredWorldspaces();
    },

    hasPreloaded: false,

    createMapLayer(layerId: string, textureData: { type: 'svg' | 'url', content: string }, config: MapConfig, isFallback: boolean = false): HTMLElement {
        let el: HTMLElement;
        if (textureData.type === 'svg') {
            el = document.createElement('div');
            el.innerHTML = textureData.content;
            const svgElement = el.querySelector('svg');
            if (svgElement) svgElement.id = 'map-bg';
        } else {
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.src = config.texturePath;
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { alpha: false });
                if (ctx) ctx.drawImage(img, 0, 0);
            };
            el = canvas;
            el.draggable = false;
        }
        
        el.id = layerId;
        el.className = 'map-bg-layer';
        
        if (isFallback) {
            el.classList.add('active');
        }
        
        return el;
    },

    preloadDiscoveredWorldspaces() {
        if (this.hasPreloaded) return;
        this.hasPreloaded = true;
        
        console.log('[AssetManager] Preloading discovered worldspaces into DOM...');
        const container = document.getElementById('map-bg-container');
        if (!container) return;
        
        const discoveredEditorIDs = new Set<string>();
        for (const config of Object.values(this.mapConfigs)) {
            if (config.worldspaceEditorID) {
                discoveredEditorIDs.add(config.worldspaceEditorID);
            }
        }

        const configsToLoad: MapConfig[] = [DEFAULT_BLANK_CONFIG];

        for (const editorID of discoveredEditorIDs) {
            const preferredConfigID = appSettings.preferredMapConfigs[editorID];
            let config = preferredConfigID ? this.getMapConfig(preferredConfigID) : this.getDefaultMapConfigForWorldspace(editorID);
            if (config === DEFAULT_BLANK_CONFIG) config = this.getDefaultMapConfigForWorldspace(editorID);
            configsToLoad.push(config);
        }
        
        for (const config of configsToLoad) {
            const textureData = this.getMapTextureData(config.texturePath);
            const layerId = `map-layer-${config.texturePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            if (!document.getElementById(layerId)) {
                const layer = this.createMapLayer(layerId, textureData, config, false);
                container.appendChild(layer);
            }
        }
    },

    getMapConfig(configID: string): MapConfig {
        return this.mapConfigs[configID] || DEFAULT_BLANK_CONFIG;
    },

    getDefaultMapConfigForWorldspace(worldspaceEditorID: string): MapConfig {
        const allConfigs = Object.values(this.mapConfigs);
        
        const searchID = worldspaceEditorID.toLowerCase();
        const defaultFallback = allConfigs.find(c => c.worldspaceEditorID?.toLowerCase() === searchID && c.configID?.toLowerCase().includes('default'));
        if (defaultFallback) return defaultFallback;
        
        const anyFallback = allConfigs.find(c => c.worldspaceEditorID?.toLowerCase() === searchID);
        if (anyFallback) return anyFallback;
        
        return DEFAULT_BLANK_CONFIG;
    },

    getMapTextureData(texturePath: string): { type: 'svg' | 'url', content: string } {
        if (this.assetCache[texturePath]) {
            return { type: 'svg', content: this.assetCache[texturePath] };
        }
        return { type: 'url', content: texturePath };
    },

    getLocationIconUrl(engineType: number, discovered?: boolean, customIcon?: string): string {
        const iconBase = customIcon || ENGINE_MARKER_TYPES[engineType] || 'default';
        const isUndiscovered = !discovered && (customIcon || engineType < 81);
        return `assets/icons/location/${iconBase}${isUndiscovered ? '_undiscovered' : ''}.svg`;
    },

    getQuestMarkerIconUrl(isDoor: boolean, isActive: boolean): string {
        const semanticName = isDoor ? 'quest-door' : 'quest';
        const stateSuffix = isActive ? '' : '_inactive';
        return `assets/icons/${semanticName}${stateSuffix}.svg`;
    },
    
    getIconUrl(iconName: string): string {
        return `assets/icons/${iconName}.svg`;
    },

    getLocationIconSvg(engineType: number, discovered?: boolean, customIcon?: string): string {
        const url = this.getLocationIconUrl(engineType, discovered, customIcon);
        return this.assetCache[url] || '';
    },

    getQuestMarkerIconSvg(isDoor: boolean, isActive: boolean): string {
        const url = this.getQuestMarkerIconUrl(isDoor, isActive);
        return this.assetCache[url] || '';
    },

    getIconSvg(iconName: string): string {
        const url = this.getIconUrl(iconName);
        return this.assetCache[url] || '';
    }
};
