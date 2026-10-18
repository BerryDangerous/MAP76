/**
 * seams.ts
 *
 * Defines foundational communication contracts, spatial geometry, discriminated
 * marker models, and input routing interfaces used across subsystem seams in MAP76.
 *
 * By isolating these contracts into a standalone module, subsystems (MapSurface,
 * OverlayCoordinator, InputRouter, AppShell) can communicate without direct coupling
 * or cyclical dependencies.
 */


/**
 * Immutable bounding rectangle in screen pixel space (CSS pixels).
 * Emitted by spatial canvas elements so overlays and tooltips can anchor themselves
 * without directly querying or mutating the map DOM hierarchy.
 */
export interface ScreenAnchor {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * Generic two-dimensional coordinate point in spatial coordinate space.
 */
export interface Point2D {
    readonly x: number;
    readonly y: number;
}

/**
 * Three-dimensional coordinate point in game worldspace.
 * Inherits from Point2D so 3D coordinates can be passed directly to 2D map projection
 * and panning functions without destructuring or manual conversions.
 */
export interface Point3D extends Point2D {
    readonly z: number;
}

/**
 * Closed runtime object and derived union type categorizing all map marker variants.
 * Using a `const` object alongside a derived type union guarantees both runtime
 * value access (e.g. MarkerKind.POI) and compile-time type safety.
 */
export const MarkerKind = {
    POI: 'poi',
    QUEST: 'quest',
    CUSTOM: 'custom',
    POWER_ARMOR: 'powerArmor',
} as const;

export type MarkerKind = (typeof MarkerKind)[keyof typeof MarkerKind];

/**
 * Selection payload for Points of Interest and settlements.
 * Carries the game engine formId and worldspaceId for domain store resolution.
 */
export interface PoiMarkerSelectPayload {
    readonly kind: typeof MarkerKind.POI;
    readonly formId: number;
    readonly worldspaceId: number;
    readonly anchor: ScreenAnchor;
}

/**
 * Selection payload for active quest objective targets.
 * Strictly carries the quest formId rather than a generic marker ID.
 */
export interface QuestMarkerSelectPayload {
    readonly kind: typeof MarkerKind.QUEST;
    readonly questFormId: number;
    readonly worldspaceId: number;
    readonly anchor: ScreenAnchor;
}

/**
 * Selection payload for user-placed custom waypoints.
 * Custom markers do not have engine formIds; they are defined purely by world coordinates.
 */
export interface CustomMarkerSelectPayload {
    readonly kind: typeof MarkerKind.CUSTOM;
    readonly worldspaceId: number;
    readonly coordinates: Point2D;
    readonly anchor: ScreenAnchor;
}

/**
 * Selection payload for the player's deployed Power Armor suit.
 * Power Armor markers are defined by 3D world coordinates rather than formIds.
 */
export interface PowerArmorMarkerSelectPayload {
    readonly kind: typeof MarkerKind.POWER_ARMOR;
    readonly worldspaceId: number;
    readonly coordinates: Point3D;
    readonly anchor: ScreenAnchor;
}

/**
 * Discriminated union of all marker selection payloads.
 * Consumers (such as OverlayCoordinator) narrow the payload using `switch (payload.kind)`
 * or `if (payload.kind === MarkerKind.POI)`.
 */
export type MarkerSelectPayload =
    | PoiMarkerSelectPayload
    | QuestMarkerSelectPayload
    | CustomMarkerSelectPayload
    | PowerArmorMarkerSelectPayload;

/**
 * Hover event payload emitted when the user hovers over any map marker.
 * Emits null when the pointer leaves the hovered marker.
 */
export interface MarkerHoverPayload {
    readonly kind: MarkerKind;
    readonly name: string;
    readonly anchor: ScreenAnchor;
    readonly formId?: number;
}

/**
 * Payload emitted when the user clicks empty terrain on the map.
 * Contains both translated game world coordinates (for waypoint placement)
 * and screen viewport coordinates (for panel positioning).
 */
export interface EmptyMapClickPayload {
    readonly worldCoordinates: Point2D;
    readonly screenCoordinates: Point2D;
    readonly worldspaceId: number;
}

/**
 * Payload emitted when initiating a fast travel action to a target location.
 */
export interface FastTravelRequestPayload {
    readonly formId: number;
    readonly name: string;
    readonly worldspaceId?: number;
}

/**
 * Seam event contract defining all events emitted by the MapSurface facade.
 * Used as the generic constraint for TypedEventEmitter<MapEvents>.
 */
export interface MapEvents {
    readonly markerSelect: MarkerSelectPayload;
    readonly markerHover: MarkerHoverPayload | null;
    readonly emptyMapClick: EmptyMapClickPayload;
    readonly fastTravelRequest: FastTravelRequestPayload;
}

/**
 * Semantic input action symbols translated from raw keyboard/gamepad events.
 */
export const KeyAction = {
    NAV_UP: 'NAV_UP',
    NAV_DOWN: 'NAV_DOWN',
    NAV_LEFT: 'NAV_LEFT',
    NAV_RIGHT: 'NAV_RIGHT',
    NAV_BACK: 'NAV_BACK',
    TAB_PREV: 'TAB_PREV',
    TAB_NEXT: 'TAB_NEXT',
    SELECT: 'SELECT',
    COLLAPSE: 'COLLAPSE',
    CLOSE_MAP: 'CLOSE_MAP',
    PLACE_MARKER: 'PLACE_MARKER',
    ZOOM_IN: 'ZOOM_IN',
    ZOOM_OUT: 'ZOOM_OUT',
    PAN_MOUSE: 'PAN_MOUSE',
    CENTER_CAMERA: 'CENTER_CAMERA',
    CENTER_ITEM: 'CENTER_ITEM',
    OPEN_SETTINGS: 'OPEN_SETTINGS',
    OPEN_MENU: 'OPEN_MENU',
    RESET_DEFAULTS: 'RESET_DEFAULTS',
    TOGGLE_ACTIVE: 'TOGGLE_ACTIVE',
    TOGGLE_SUPPLY_LINES: 'TOGGLE_SUPPLY_LINES',
    PREV_WORLD: 'PREV_WORLD',
    NEXT_WORLD: 'NEXT_WORLD',
    SORT: 'SORT',
    CHANGE_LAYOUT: 'CHANGE_LAYOUT',
} as const;

export type KeyAction = (typeof KeyAction)[keyof typeof KeyAction];

/**
 * Keybind control hints presented on the bottom ControlBar.
 */
export type ControlActionHint = KeyAction | { readonly action: KeyAction; readonly label: string };
export type ControlActionDef = ControlActionHint; // Backward-compatibility alias

/**
 * Standard focus owner identifiers representing UI layers in the FocusStack.
 */
export const FocusOwner = {
    MAP: 'MAP',
    MARKER_CARD: 'MARKER_CARD',
    SETTLEMENT_CARD: 'SETTLEMENT_CARD',
    CUSTOM_MARKER_CARD: 'CUSTOM_MARKER_CARD',
    QUEST_CARD: 'QUEST_CARD',
    QUEST_LIST: 'QUEST_LIST',
    WORKSHOP_LIST: 'WORKSHOP_LIST',
    SEARCH_PANEL: 'SEARCH_PANEL',
    SETTINGS_MENU: 'SETTINGS_MENU',
    MODAL: 'MODAL',
} as const;

export type FocusOwner = (typeof FocusOwner)[keyof typeof FocusOwner];

/**
 * Interface implemented by any UI component or subsystem that accepts routed input.
 * In the LIFO FocusStack architecture, active receivers strictly trap input to prevent
 * unhandled keystrokes from leaking to the underlying map canvas.
 */
export interface InputReceiver {
    /**
     * Unique identifier for this receiver in the FocusStack.
     */
    readonly id: FocusOwner;

    /**
     * Handles a semantic action dispatched from the InputRouter.
     * @param action The normalized semantic action symbol.
     * @returns True if the action was consumed; false if dropped.
     */
    handleAction(action: KeyAction): boolean;

    /**
     * Lifecycle callback triggered when this receiver gains active focus.
     */
    onFocusGained?(): void;

    /**
     * Lifecycle callback triggered when this receiver loses active focus.
     * @param newFocusId The ID of the component gaining focus, if known.
     */
    onFocusLost?(newFocusId?: FocusOwner): void;

    /**
     * Provides action hints for the bottom ControlBar while this receiver is focused.
     */
    getAvailableControls?(): ControlActionHint[];
}

export type EventListener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

/**
 * Contract interface for typed in-memory event emitters across subsystem seams.
 */
export interface IEventEmitter<TMap extends Record<string, any>> {
    on<K extends keyof TMap>(event: K, listener: EventListener<TMap[K]>): Unsubscribe;
    off<K extends keyof TMap>(event: K, listener: EventListener<TMap[K]>): void;
    emit<K extends keyof TMap>(event: K, payload: TMap[K]): void;
}
