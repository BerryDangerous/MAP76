export type SearchResultType = 'marker' | 'workshop' | 'quest' | 'powerArmor' | 'customMarker' | 'setting';

export interface SearchResult {
    id: string;
    type: SearchResultType;
    title: string;
    titleMatchIndices: number[];
    subtitle?: string;
    subtitleMatchIndices?: number[];
    originalRef: any;
    markerCoords?: {
        x: number;
        y: number;
        z?: number;
        worldspace?: number;
    };
    iconType?: number;
    customIcon?: string;
    badgesHtml?: string;
    score: number;
}
