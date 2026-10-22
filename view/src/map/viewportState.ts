export interface ViewportTransform {
    zoom: number;
    panX: number;
    panY: number;
}

export interface ViewportState {
    zoom: number;
    maxZoomOut: number;
    maxZoomIn: number;
    panX: number;
    panY: number;
    isDragging: boolean;
    wasDragged: boolean;
    startX: number;
    startY: number;

    savedViewport: ViewportTransform | null;
    worldViewports: Record<number, ViewportTransform>;

    /**
     * @todo(ticket=04-map-surface) Temporary holding array for animated DOM marker elements.
     * Evict when MapSurface encapsulates marker lifecycle and animation frames.
     */
    animatedElements: HTMLElement[];
    pendingCenterOnPlayer: boolean;
}

export const viewportState: ViewportState = {
    zoom: 1.0,
    maxZoomOut: 1.0,
    maxZoomIn: 5.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    wasDragged: false,
    startX: 0,
    startY: 0,

    savedViewport: null,
    worldViewports: {},

    animatedElements: [],
    pendingCenterOnPlayer: true
};
