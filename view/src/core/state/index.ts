import { MapConfig, PlayerData } from '@/types/map.js';
import { POIMarker } from '@/types/markers.js';
import { F4SEMapPayload, SettlementData, WorldspaceDTO } from '@/types/payloads.js';
import { QuestItem } from '@/types/quests.js';

import { COMMONWEALTH_WORLDSPACE_ID } from '@/core/constants.js';

export interface PlayerState {
    x: number;
    y: number;
    z: number;
    angle: number;
    active: boolean;
    worldspace?: number;
}

export interface DomainState {
    player: PlayerState;
    selectedWorldspaceID: number | null;
    activeMapConfig: MapConfig;
    lastPayload: F4SEMapPayload | null;

    markers: Map<number, POIMarker>;
    quests: Map<number, QuestItem>;
    settlements: Map<number, SettlementData>;
    worldspaces: Map<number, WorldspaceDTO>;
    favoriteLocations: Set<number>;

    getActiveWorldspaceID(): number;
    setPayload(payload: F4SEMapPayload | null): void;
    updatePlayer(player: Partial<PlayerData> & { active?: boolean }): void;
    toggleFavoriteLocation(formId: number): boolean;
    setSelectedWorldspace(worldspaceId: number | null): void;
    setActiveMapConfig(config: MapConfig): void;
}

class DomainStore implements DomainState {
    player: PlayerState = {
        x: 0,
        y: 0,
        z: 0,
        angle: 0,
        active: false
    };

    selectedWorldspaceID: number | null = null;

    /**
     * Authoritative source of truth for the currently active/viewed worldspace ID.
     */
    getActiveWorldspaceID(): number {
        return this.selectedWorldspaceID ?? this.player.worldspace ?? COMMONWEALTH_WORLDSPACE_ID;
    }

    activeMapConfig: MapConfig = {
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

    private _lastPayload: F4SEMapPayload | null = null;

    markers = new Map<number, POIMarker>();
    quests = new Map<number, QuestItem>();
    settlements = new Map<number, SettlementData>();
    worldspaces = new Map<number, WorldspaceDTO>();
    favoriteLocations = new Set<number>();

    get lastPayload(): F4SEMapPayload | null {
        return this._lastPayload;
    }

    set lastPayload(payload: F4SEMapPayload | null) {
        this.setPayload(payload);
    }

    /**
     * Synchronizes the raw game engine payload with normalized domain collections.
     */
    setPayload(payload: F4SEMapPayload | null): void {
        this._lastPayload = payload;

        this.markers.clear();
        this.quests.clear();
        this.settlements.clear();
        this.worldspaces.clear();
        this.favoriteLocations.clear();

        if (!payload) return;

        if (payload.markers) {
            for (const marker of payload.markers) {
                this.markers.set(marker.formId, marker);
            }
        }

        if (payload.quests) {
            for (const quest of payload.quests) {
                this.quests.set(quest.formId, quest);
            }
        }

        if (payload.settlements) {
            for (const settlement of payload.settlements) {
                this.settlements.set(settlement.formId, settlement);
            }
        }

        if (payload.worldspaces) {
            for (const [wsIdStr, ws] of Object.entries(payload.worldspaces)) {
                this.worldspaces.set(parseInt(wsIdStr, 10), ws);
            }
        }

        if (payload.favoriteLocations) {
            for (const favId of payload.favoriteLocations) {
                this.favoriteLocations.add(favId);
            }
        }

        if (payload.player) {
            this.updatePlayer(payload.player);
        }
    }

    /**
     * Updates player position, orientation, or active status, maintaining lock-step with lastPayload.
     */
    updatePlayer(player: Partial<PlayerData> & { active?: boolean }): void {
        if (player.x !== undefined) this.player.x = player.x;
        if (player.y !== undefined) this.player.y = player.y;
        if (player.z !== undefined) this.player.z = player.z;
        if (player.angle !== undefined) this.player.angle = player.angle;
        if (player.worldspace !== undefined) this.player.worldspace = player.worldspace;
        if (player.active !== undefined) this.player.active = player.active;

        if (this._lastPayload) {
            if (!this._lastPayload.player) {
                this._lastPayload.player = {
                    x: this.player.x,
                    y: this.player.y,
                    z: this.player.z,
                    angle: this.player.angle,
                    worldspace: this.player.worldspace ?? 0
                };
            } else {
                if (player.x !== undefined) this._lastPayload.player.x = player.x;
                if (player.y !== undefined) this._lastPayload.player.y = player.y;
                if (player.z !== undefined) this._lastPayload.player.z = player.z;
                if (player.angle !== undefined) this._lastPayload.player.angle = player.angle;
                if (player.worldspace !== undefined) this._lastPayload.player.worldspace = player.worldspace;
            }
        }
    }

    /**
     * Toggles a location's favorite status and synchronizes the change with lastPayload.
     */
    toggleFavoriteLocation(formId: number): boolean {
        const isFav = this.favoriteLocations.has(formId);
        if (isFav) {
            this.favoriteLocations.delete(formId);
        } else {
            this.favoriteLocations.add(formId);
        }

        if (this._lastPayload) {
            this._lastPayload.favoriteLocations = Array.from(this.favoriteLocations);
        }

        return !isFav;
    }

    setSelectedWorldspace(worldspaceId: number | null): void {
        this.selectedWorldspaceID = worldspaceId;
    }

    setActiveMapConfig(config: MapConfig): void {
        this.activeMapConfig = config;
    }
}

export const domainState: DomainState = new DomainStore();
