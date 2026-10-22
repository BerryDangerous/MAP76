import { Point2D, MapEvents, ScreenAnchor, MarkerKind } from '@/types/seams.js';
import { GameBounds, MapConfig, PlayerData } from '@/types/map.js';
import { F4SEMapPayload, SettlementData } from '@/types/payloads.js';

import { DEFAULT_BLANK_CONFIG, DEFAULT_MAP_GUTTERS, FAR_HARBOR_MAP_GUTTERS, NUKA_WORLD_MAP_GUTTERS } from '@/core/constants.js';
import { TypedEventEmitter } from '@/core/events.js';
import { appSettings } from '@/core/settings.js';
import { domainState } from '@/core/state/index.js';
import { getWorldspaceEditorID, isSameWorldspace } from '@/core/state/worldspaces.js';

import { AssetManager } from '@/systems/assetManager.js';
import { SoundService } from '@/services/soundService.js';

import { screenToGameCoords, gameToMapCoords } from '@/map/coordinates.js';
import { resolveGatewayTarget } from '@/map/gateways.js';
import { viewportState } from '@/map/viewportState.js';
import { MapViewport } from '@/map/viewport.js';
import { MarkerInteractionManager, activeHoveredMarker } from '@/map/interactions.js';
import {
    renderPlayer,
    renderLocationMarkers,
    renderQuestMarkers,
    renderCustomMarker,
    renderPowerArmor,
    applySupplyLinesVisibilityFilter,
    calculateFinalGutters
} from '@/map/markers.js';
import {
    initSupplyLinesLayer,
    renderSupplyLines,
    toggleSupplyLinesView,
    isSupplyLinesViewActive,
    setSupplyLinesViewActive,
    hasSupplyLines
} from '@/map/supplyLines.js';

export interface MapSurfaceOptions {
    viewportElement: HTMLElement;
    containerElement?: HTMLElement;
    markerLayer?: HTMLElement;
    playerLayer?: HTMLElement;
    questLayer?: HTMLElement;
    supplyLinesLayer?: SVGSVGElement;
}

/**
 * MapSurface facade.
 * Encapsulates all map rendering, viewport management, coordinate projection math,
 * gateway pathfinding, and supply route drawing behind a single, high-leverage facade.
 */
export class MapSurface {
    public readonly events: TypedEventEmitter<MapEvents>;

    private _viewportEl: HTMLElement | null = null;
    private _containerEl: HTMLElement | null = null;
    private _markerLayerEl: HTMLElement | null = null;
    private _playerLayerEl: HTMLElement | null = null;
    private _questLayerEl: HTMLElement | null = null;
    private _supplyLinesLayerEl: SVGSVGElement | null = null;

    private _worldspaceConfigs = new Map<number, MapConfig>();
    private _activeConfig: MapConfig;
    private _isInitialized = false;

    constructor(events?: TypedEventEmitter<MapEvents>) {
        this.events = events ?? new TypedEventEmitter<MapEvents>();
        this._activeConfig = {
            mapName: "Commonwealth",
            worldspaceID: 60,
            texturePath: "assets/maps/commonwealth/default.png",
            gutters: {
                left: 0.02685546875,
                right: 0.0283203125,
                top: 0.02685546875,
                bottom: 0.0283203125
            }
        };
    }

    public init(options: MapSurfaceOptions): void {
        this._viewportEl = options.viewportElement;
        this._containerEl = options.containerElement ?? document.getElementById('screen-container');
        this._markerLayerEl = options.markerLayer ?? document.getElementById('marker-layer');
        this._playerLayerEl = options.playerLayer ?? document.getElementById('player-layer');
        this._questLayerEl = options.questLayer ?? document.getElementById('quest-layer');
        this._supplyLinesLayerEl = options.supplyLinesLayer ?? (document.getElementById('supply-lines-layer') as unknown as SVGSVGElement | null);

        this._isInitialized = true;

        initSupplyLinesLayer();
        MapViewport.bindSurface(this, this._viewportEl, this._containerEl);
        MarkerInteractionManager.bindSurface(this, this._containerEl);
        MapViewport.initEvents();
        MarkerInteractionManager.initEvents();
        MapViewport.centerInitialViewport();
    }

    public getActiveConfig(): MapConfig {
        return this._activeConfig;
    }

    public invalidateConfig(worldspaceID?: number): void {
        if (worldspaceID !== undefined) {
            this._worldspaceConfigs.delete(worldspaceID);
        } else {
            this._worldspaceConfigs.clear();
        }
    }

    public setWorldspaceConfig(worldspaceID: number, config: MapConfig): void {
        this._worldspaceConfigs.set(worldspaceID, config);
        if (worldspaceID === this._activeConfig.worldspaceID) {
            this._activeConfig = config;
        }
    }

    public getResolvedConfig(worldspaceID: number, worldspaceEditorID?: string): MapConfig {
        const cached = this._worldspaceConfigs.get(worldspaceID);
        if (cached) {
            const isBlankFallback = cached.texturePath === DEFAULT_BLANK_CONFIG.texturePath;
            const assetsNowAvailable = Object.keys(AssetManager.mapConfigs).length > 0;
            let isStale = false;

            if (isBlankFallback && assetsNowAvailable) {
                isStale = true;
            } else if (worldspaceEditorID) {
                const preferredConfigID = appSettings.preferredMapConfigs[worldspaceEditorID];
                if (preferredConfigID) {
                    if (cached.configID !== preferredConfigID && cached.mapName !== preferredConfigID) {
                        isStale = true;
                    }
                } else {
                    const isDefault = Boolean(
                        cached.configID?.toLowerCase().includes('default') || 
                        cached.mapName?.toLowerCase() === 'default'
                    );
                    if (!isDefault) {
                        isStale = true;
                    }
                }
            }

            if (!isStale) {
                return cached;
            }
        }

        let config: MapConfig;
        if (worldspaceEditorID) {
            const preferredConfigID = appSettings.preferredMapConfigs[worldspaceEditorID];
            let preferred = preferredConfigID 
                ? AssetManager.getMapConfig(preferredConfigID) 
                : AssetManager.getDefaultMapConfigForWorldspace(worldspaceEditorID);

            if (preferred === DEFAULT_BLANK_CONFIG) {
                preferred = AssetManager.getDefaultMapConfigForWorldspace(worldspaceEditorID);
            }

            const finalGutters = calculateFinalGutters(preferred);
            config = {
                ...DEFAULT_BLANK_CONFIG,
                ...preferred,
                worldspaceID,
                mapName: preferred.mapName || worldspaceEditorID,
                gutters: finalGutters,
                imageDimensions: preferred.imageDimensions,
                imageGuttersPixels: preferred.imageGuttersPixels
            };
        } else {
            config = {
                ...DEFAULT_BLANK_CONFIG,
                mapName: "Custom Worldspace",
                worldspaceID
            };
        }

        if (config.texturePath !== DEFAULT_BLANK_CONFIG.texturePath || Object.keys(AssetManager.mapConfigs).length > 0) {
            this._worldspaceConfigs.set(worldspaceID, config);
        }
        return config;
    }

    public updateWorldspaceConfig(worldspaceID: number, worldspaceEditorID?: string): void {
        const config = this.getResolvedConfig(worldspaceID, worldspaceEditorID);
        this._activeConfig = config;

        if (this._isInitialized) {
            const container = document.getElementById('map-bg-container');
            if (container) {
                const texturePath = config.texturePath;
                const textureData = AssetManager.getMapTextureData(texturePath);
                
                Array.from(container.children).forEach((child: Element) => {
                    child.classList.remove('active');
                });

                const layerId = `map-layer-${texturePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
                let activeLayer = document.getElementById(layerId);

                if (activeLayer) {
                    activeLayer.classList.add('active');
                } else {
                    console.warn(`[Map] Expected layer ${layerId} was not preloaded into DOM. Fallback triggered.`);
                    const layer = AssetManager.createMapLayer(layerId, textureData, config, true);
                    container.appendChild(layer);
                }
            }
        }
    }

    public switchWorldspace(wsId: number, isManualSelection: boolean = true): void {
        this.saveCurrentWorldViewport(this._activeConfig.worldspaceID);

        if (isManualSelection) {
            domainState.setSelectedWorldspace(wsId);
        } else {
            domainState.setSelectedWorldspace(null);
        }
        const editorID = getWorldspaceEditorID(wsId);
        this.updateWorldspaceConfig(wsId, editorID);
        this.events.emit('worldspaceChange', { worldspaceId: wsId, editorId: editorID });

        this.render(true);
    }

    public render(preserveViewport: boolean = false): void {
        if (!this._isInitialized || !this._viewportEl) return;

        const activeWsId = domainState.getActiveWorldspaceID();
        const editorID = getWorldspaceEditorID(activeWsId);
        this.updateWorldspaceConfig(activeWsId, editorID);
        this.events.emit('worldspaceChange', { worldspaceId: activeWsId, editorId: editorID });

        const config = this._activeConfig;
        const playerLayer = this._playerLayerEl ?? document.getElementById('player-layer');
        const markerLayer = this._markerLayerEl ?? document.getElementById('marker-layer');
        if (!playerLayer || !markerLayer) return;

        const worldspaceData = domainState.worldspaces.get(config.worldspaceID);
        const bounds = worldspaceData?.bounds;
        if (!bounds) {
            console.error(`[MapSurface] No bounds data found for worldspace ${config.worldspaceID}`);
            return;
        }

        viewportState.animatedElements = [];

        playerLayer.innerHTML = '';
        markerLayer.innerHTML = '';
        let questLayer = this._questLayerEl ?? document.getElementById('quest-layer');
        if (!questLayer && markerLayer && playerLayer) {
            questLayer = document.createElement('div');
            questLayer.id = 'quest-layer';
            markerLayer.parentNode?.insertBefore(questLayer, playerLayer);
            this._questLayerEl = questLayer;
        }
        if (questLayer) questLayer.innerHTML = '';

        renderPlayer(domainState.player, config.worldspaceID, bounds, config.gutters!, config.cellBounds);
        renderSupplyLines(domainState.lastPayload, config);
        renderLocationMarkers(Array.from(domainState.markers.values()), config.worldspaceID, bounds, config.gutters!, config.cellBounds);
        if (questLayer) {
            renderQuestMarkers(Array.from(domainState.quests.values()), config.worldspaceID, bounds, questLayer, config.gutters!, domainState.lastPayload?.gateways, config.cellBounds);
            if (domainState.lastPayload?.custom_marker) {
                renderCustomMarker(domainState.lastPayload.custom_marker, config.worldspaceID, bounds, questLayer, config.gutters!, domainState.lastPayload?.gateways, config.cellBounds);
            }
            if (domainState.lastPayload?.power_armor) {
                renderPowerArmor(domainState.lastPayload.power_armor, config.worldspaceID, bounds, questLayer, config.gutters!, domainState.lastPayload?.gateways, config.cellBounds);
            }
        }

        applySupplyLinesVisibilityFilter();

        if (viewportState.pendingCenterOnPlayer && domainState.player.active) {
            this.centerOnWorldCoords(domainState.player.x, domainState.player.y);
            viewportState.pendingCenterOnPlayer = false;
        } else {
            if (viewportState.pendingCenterOnPlayer) {
                viewportState.pendingCenterOnPlayer = false;
            }
            if (preserveViewport) {
                const saved = viewportState.worldViewports[config.worldspaceID];
                if (saved) {
                    viewportState.zoom = saved.zoom;
                    viewportState.panX = saved.panX;
                    viewportState.panY = saved.panY;
                    MapViewport.updateViewportTransform();
                } else {
                    MapViewport.centerInitialViewport();
                }
            } else {
                MapViewport.updateViewportTransform();
            }
        }
    }

    public updatePlayer(player: Partial<PlayerData> & { active?: boolean }): void {
        domainState.updatePlayer(player);
        if (!this._isInitialized || !this._viewportEl) return;

        const config = this._activeConfig;
        const pImg = document.getElementById('player-marker') as HTMLDivElement | null;
        if (player.worldspace !== undefined && !isSameWorldspace(player.worldspace, config.worldspaceID)) {
            if (domainState.selectedWorldspaceID === null) {
                this.switchWorldspace(player.worldspace, false);
                return;
            }
            if (pImg) pImg.style.display = 'none';
            domainState.updatePlayer({ active: false });
            return;
        }

        const worldspaceData = domainState.worldspaces.get(config.worldspaceID);
        const bounds = worldspaceData?.bounds;
        if (!bounds) return;

        if (!pImg) {
            renderPlayer(domainState.player, config.worldspaceID, bounds, config.gutters!, config.cellBounds);
        } else {
            pImg.style.display = '';
            const pos = gameToMapCoords(domainState.player.x, domainState.player.y, domainState.player.z, bounds, config.gutters!, config.cellBounds);
            pImg.style.left = `${pos.x}%`;
            pImg.style.top = `${pos.y}%`;
            pImg.style.setProperty('--player-angle', `${domainState.player.angle}deg`);
        }
    }

    public centerOnCoords(coords: Point2D, targetZoom: number = 2.5): void {
        this.centerOnWorldCoords(coords.x, coords.y, targetZoom);
    }

    public centerOnWorldCoords(gameX: number, gameY: number, targetZoom: number = 2.5): void {
        if (!this._isInitialized || !this._viewportEl) return;
        const config = this._activeConfig;
        const bounds = domainState.worldspaces.get(config.worldspaceID)?.bounds;
        if (bounds) {
            MapViewport.centerOnMapCoords(gameX, gameY, bounds, targetZoom);
        }
    }

    public centerOnTarget(worldspace: number, x: number, y: number, z: number = 0, targetZoom: number = 2.5): boolean {
        if (!this._isInitialized || !this._viewportEl) return false;
        const config = this._activeConfig;
        const resolved = resolveGatewayTarget(
            worldspace,
            config.worldspaceID,
            x,
            y,
            z,
            domainState.player.x,
            domainState.player.y,
            domainState.lastPayload?.gateways,
            domainState.markers
        );
        if (resolved) {
            this.centerOnWorldCoords(resolved.x, resolved.y, targetZoom);
            return true;
        }
        return false;
    }

    public centerOnMarker(formId: number, targetZoom: number = 2.5): boolean {
        const marker = domainState.markers.get(formId);
        if (marker) {
            return this.centerOnTarget(marker.worldspace, marker.x, marker.y, 0, targetZoom);
        }
        return false;
    }

    public centerOnElement(el: HTMLElement, targetZoom: number = 2.5): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.centerOnElement(el, targetZoom);
    }

    public clearSavedViewport(restore: boolean = true): void {
        MapViewport.clearSavedViewport(restore);
    }

    public saveCurrentViewport(): void {
        MapViewport.saveCurrentViewport();
    }

    public saveCurrentWorldViewport(wsId?: number): void {
        const targetWsId = wsId ?? this._activeConfig.worldspaceID;
        viewportState.worldViewports[targetWsId] = {
            zoom: viewportState.zoom,
            panX: viewportState.panX,
            panY: viewportState.panY
        };
    }

    public updateViewportTransform(): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.updateViewportTransform();
    }

    public centerInitialViewport(): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.centerInitialViewport();
    }

    public setZoomHold(direction: 'in' | 'out' | null, clientX?: number, clientY?: number): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.setZoomHold(direction, clientX ?? MapViewport.lastMouseX, clientY ?? MapViewport.lastMouseY);
    }

    public setPan(x: number, y: number): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.setPan(x, y);
    }

    public panBy(dx: number, dy: number): void {
        if (!this._isInitialized || !this._viewportEl) return;
        MapViewport.panBy(dx, dy);
    }

    public toggleSupplyLines(): boolean {
        const res = toggleSupplyLinesView();
        applySupplyLinesVisibilityFilter();
        return res;
    }

    public isSupplyLinesActive(): boolean {
        return isSupplyLinesViewActive();
    }

    public setSupplyLinesActive(active: boolean): void {
        setSupplyLinesViewActive(active);
        applySupplyLinesVisibilityFilter();
    }

    public hasSupplyLines(): boolean {
        return hasSupplyLines();
    }

    public activateHoveredMarker(): boolean {
        if (activeHoveredMarker) {
            activeHoveredMarker.click();
            return true;
        }
        return false;
    }

    public requestFastTravel(formId: number, name: string): void {
        this.events.emit('fastTravelRequest', {
            formId,
            name,
            worldspaceId: this._activeConfig.worldspaceID
        });
    }

    public setPendingCenterOnPlayer(pending: boolean = true): void {
        viewportState.pendingCenterOnPlayer = pending;
    }

    public triggerCustomMarkerPlacement(): void {
        if (!this._isInitialized || !this._viewportEl) return;
        const config = this._activeConfig;
        const bounds = domainState.worldspaces.get(config.worldspaceID)?.bounds;
        if (!bounds) return;

        const worldCoords = screenToGameCoords(
            MapViewport.lastMouseX,
            MapViewport.lastMouseY,
            bounds,
            config.gutters!,
            viewportState.zoom,
            viewportState.panX,
            viewportState.panY,
            config.cellBounds
        );

        this.events.emit('emptyMapClick', {
            worldCoordinates: worldCoords,
            screenCoordinates: { x: MapViewport.lastMouseX, y: MapViewport.lastMouseY },
            worldspaceId: config.worldspaceID,
        });
    }

    public prepareForFastTravel(destFormId: number): void {
        const destMarker = domainState.markers.get(destFormId);
        let destSettlement: SettlementData | undefined;
        if (!destMarker) {
            for (const s of domainState.settlements.values()) {
                if (s.markerFormId === destFormId || s.formId === destFormId || s.locationFormId === destFormId) {
                    destSettlement = s;
                    break;
                }
            }
        }
        const target = destMarker || (destSettlement ? (domainState.markers.get(destSettlement.markerFormId) ?? null) : null);

        if (target) {
            domainState.updatePlayer({
                x: target.x,
                y: target.y,
                worldspace: target.worldspace,
                active: true
            });
            domainState.setSelectedWorldspace(target.worldspace);

            if (appSettings.centerOnPlayerWhenOpened) {
                delete viewportState.worldViewports[target.worldspace];
                viewportState.savedViewport = null;
                viewportState.pendingCenterOnPlayer = true;
            }

            if (target.worldspace !== this._activeConfig.worldspaceID) {
                const editorID = getWorldspaceEditorID(target.worldspace);
                this.updateWorldspaceConfig(target.worldspace, editorID);
                this.events.emit('worldspaceChange', { worldspaceId: target.worldspace, editorId: editorID });
            }
        }
    }

    public get lastMouseX(): number {
        return MapViewport.lastMouseX;
    }

    public get lastMouseY(): number {
        return MapViewport.lastMouseY;
    }
}

export const mapSurface = new MapSurface();
