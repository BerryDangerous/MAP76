import { GameBounds, FastTravelStatus, PlayerData } from './map.js';
import { POIMarker, CustomWaypoint } from './markers.js';
import { QuestItem } from './quests.js';

export interface F4SEMapPayload {
    bounds: GameBounds;
    markers: POIMarker[];
    quests: QuestItem[];
    custom_waypoint: CustomWaypoint | null;
    player?: PlayerData;
}

export interface FastTravelFailPayload {
    status: FastTravelStatus;
    formId: number;
    locationName: string;
}

export interface FastTravelCheckPayload {
    status: FastTravelStatus;
}
