export interface GameBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    nwCellX?: number;
    nwCellY?: number;
    seCellX?: number;
    seCellY?: number;
    usableWidth?: number;
    usableHeight?: number;
    mapScale?: number;
    mapOffsetX?: number;
    mapOffsetY?: number;
    mapOffsetZ?: number;
}

export interface MapGutters {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface CellBoundsOverride {
    nwCellX: number;
    nwCellY: number;
    seCellX: number;
    seCellY: number;
}

export interface MapPosition {
    x: number;
    y: number;
}

export interface MapConfig {
    configID?: string;
    worldspaceEditorID?: string;
    mapName: string;
    worldspaceID: number;
    texturePath: string;
    gutters?: MapGutters;
    cellBounds?: CellBoundsOverride;
    imageDimensions?: { width: number; height: number };
    imageGuttersPixels?: MapGutters;
}

export interface AssetPayload {
    mapConfigs: Record<string, MapConfig>;
    assetCache: Record<string, string>;
}

export enum FastTravelStatus {
    SUCCESS = "SUCCESS",
    PLAYER_DEAD = "PLAYER_DEAD",
    COMBAT = "COMBAT",
    INTERIOR = "INTERIOR",
    SURVIVAL = "SURVIVAL",
    OVERBURDENED = "OVERBURDENED",
    QUEST_LOCKED = "QUEST_LOCKED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export interface PlayerData {
    x: number;
    y: number;
    z: number;
    worldspace: number;
    angle: number;
    caps?: number;
    currentWeight?: number;
    maxWeight?: number;
}
