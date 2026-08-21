import { GameBounds, FastTravelStatus, PlayerData } from '@/types/map.js';
import { POIMarker, CustomMarker, PowerArmorMarker } from '@/types/markers.js';
import { QuestItem } from '@/types/quests.js';

export interface SettlementData {
    formId: number;
    locationFormId: number;
    markerFormId: number;
    iconType?: number;
    worldspace?: number;
    name: string;
    owned: boolean;
    raider: boolean;
    vassal: boolean;
    excludedFromVassal?: boolean;
    vr: boolean;
    population: number;
    happiness: number;
    food: number;
    water: number;
    power: number;
    defense: number;
    beds: number;
    linkedLocationFormIds: number[];
}

export interface WorldspaceDTO {
    editorID: string;
    fullName: string;
    bounds: GameBounds;
}

export interface GatewayMarker {
    x: number;
    y: number;
}

export interface F4SEMapPayload {
    markers: POIMarker[];
    quests: QuestItem[];
    settlements?: SettlementData[];
    worldspaces?: Record<number, WorldspaceDTO>;
    gateways?: Record<number, Record<number, GatewayMarker[]>>;
    custom_marker?: CustomMarker | null;
    power_armor?: PowerArmorMarker | null;
    player?: PlayerData;
    dlc04VassalDistance?: number;
}

export interface FastTravelFailPayload {
    status: FastTravelStatus;
    formId: number;
    locationName: string;
}

export interface FastTravelCheckPayload {
    status: FastTravelStatus;
}

export interface FrameTickPayload {
    hour: number;
    day: number;
    month: number;
    year: number;
    player?: PlayerData;
}
