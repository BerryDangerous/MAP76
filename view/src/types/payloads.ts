import { GameBounds, FastTravelStatus, PlayerData } from './map.js';
import { POIMarker, CustomMarker, PowerArmorMarker } from './markers.js';
import { QuestItem } from './quests.js';

export interface SettlementData {
    formId: number;
    locationFormId: number;
    markerFormId: number;
    iconType?: number;
    worldspace?: number;
    worldspaceFullName?: string;
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

export interface F4SEMapPayload {
    bounds: GameBounds;
    markers: POIMarker[];
    quests: QuestItem[];
    settlements?: SettlementData[];
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
}
