export interface POIMarker {
    formId: number;
    worldspace: number;
    worldspaceEditorID?: string;
    x: number;
    y: number;
    type: number;
    name: string;
    visible: boolean;
    canFastTravel: boolean;
    discovered: boolean;
    customIcon?: string;
}

export interface CustomMarker {
    worldspace: number;
    worldspaceEditorID?: string;
    x: number;
    y: number;
}

export interface PowerArmorMarker {
    worldspace: number;
    worldspaceEditorID?: string;
    x: number;
    y: number;
    z: number;
}

export type MarkerType = 'location' | 'quest' | 'customMarker' | 'powerarmor';

