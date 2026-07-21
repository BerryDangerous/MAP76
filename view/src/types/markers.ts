export interface POIMarker {
    formId: number;
    worldspace: number;
    x: number;
    y: number;
    type: number;
    name: string;
    visible: boolean;
    canFastTravel: boolean;
    discovered: boolean;
    customIcon?: string;
}

export interface CustomWaypoint {
    worldspace: number;
    x: number;
    y: number;
}

export type MarkerType = 'location' | 'quest' | 'waypoint';
