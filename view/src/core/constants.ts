import { FastTravelStatus } from '@/types/map.js';

export const ENGINE_MARKER_TYPES: Record<number, string> = {
    0: 'cave',
    1: 'city',
    2: 'diamond-city',
    3: 'encampment',
    4: 'industrial',
    5: 'monument',
    6: 'metro',
    7: 'military-base',
    8: 'natural-landmark',
    9: 'office',
    10: 'ruins-town',
    11: 'ruins-urban',
    12: 'sanctuary',
    13: 'settlement',
    14: 'sewer',
    15: 'vault',
    16: 'airfield',
    17: 'bunker-hill',
    18: 'camper',
    19: 'car',
    20: 'church',
    21: 'country-club',
    22: 'custom-house',
    23: 'drive-in',
    24: 'elevated-highway',
    25: 'faneuil-hall',
    26: 'farm',
    27: 'filling-station',
    28: 'forest',
    29: 'good-neighbor',
    30: 'graveyard',
    31: 'hospital',
    32: 'industrial-dome',
    33: 'industrial',
    34: 'institute',
    35: 'irish-pride',
    36: 'junkyard',
    37: 'observatory',
    38: 'pier',
    39: 'pond-lake',
    40: 'quarry',
    41: 'radioactive-area',
    42: 'radio-tower',
    43: 'salem',
    44: 'school',
    45: 'shipwreck',
    46: 'submarine',
    47: 'swan-pond',
    48: 'synth-head',
    49: 'town',
    50: 'bos',
    51: 'brownstone',
    52: 'bunker',
    53: 'castle',
    54: 'skyscraper',
    55: 'libertalia',
    56: 'lowrise',
    57: 'minutemen',
    58: 'police-station',
    59: 'prydwen',
    60: 'railroad-faction',
    61: 'railroad',
    62: 'satellite',
    63: 'sentinel',
    64: 'uss-constitution',
    65: 'mechanist',
    66: 'raider-outpost',
    67: 'vassal-settlement',
    68: 'potential-vassal-settlement',
    69: 'bottling-plant',
    70: 'galactic',
    71: 'hub',
    72: 'kiddie-kingdom',
    73: 'monorail',
    74: 'rides',
    75: 'safari',
    76: 'wild-west',
    77: 'poi', // cappy
    78: 'disciples',
    79: 'operators',
    80: 'pack'
};

export const FORM_ID_INDEX_MASK = 0x00FFFFFF;
export const NAKANO_RESIDENCE_REAL_MARKER_MASKED_ID = 0x000034F6;

export const MARKER_ICON_SETTLEMENT = 13;
export const MARKER_ICON_RAIDER_OUTPOST = 66;
export const MARKER_ICON_VASSAL_SETTLEMENT = 67;
export const MARKER_ICON_POTENTIAL_VASSAL_SETTLEMENT = 68;

export const ASSET_ICON_CUSTOM_MARKER = 'custom-marker';
export const ASSET_ICON_POWER_ARMOR = 'power-armor';
export const ASSET_ICON_PLAYER_LOCATION = 'player-location';

export const CELL_SIZE_UNITS = 4096.0;

export const DEFAULT_BLANK_CONFIG = {
    mapName: "Custom Worldspace",
    worldspaceID: 0,
    texturePath: "assets/maps/blank.svg",
    gutters: {
        left: 0.02685546875,
        right: 0.0283203125,
        top: 0.02685546875,
        bottom: 0.0283203125
    }
};

export const WORLDSPACE_CONFIGS: Record<string, { mapName: string; texturePath: string; gutters: { left: number; right: number; top: number; bottom: number } }> = {
    "Commonwealth": {
        mapName: "Commonwealth",
        texturePath: "assets/maps/commonwealth/default.png",
        gutters: {
            left: 0.02685546875,
            right: 0.0283203125,
            top: 0.02685546875,
            bottom: 0.0283203125
        }
    },
    "DLC03FarHarbor": {
        mapName: "Far Harbor",
        texturePath: "assets/maps/dlc03farharbor/default.png",
        gutters: {
            left: 0.00920067,
            right: 0.03374173,
            top: 0.02515624,
            bottom: 0.00958931
        }
    },
    "NukaWorld": {
        mapName: "Nuka-World",
        texturePath: "assets/maps/nukaworld/default.png",
        gutters: {
            left: -0.045,
            right: -0.095,
            top: 0.0005,
            bottom: -0.155
        }
    }
};

export const DLC_GATEWAYS = {
    NUKA_WORLD_ID: 10511,
    FAR_HARBOR_ID: 2831,
    COMMONWEALTH_ID: 60,

    COMMONWEALTH_TO_NUKAWORLD: {
        door: { x: -111914.625, y: 18024.332, z: 0, isGateway: true },
        mapMarker: { x: -116344.0, y: 17512.0, z: 0, isGateway: true, maskedFormId: 152853 }
    },
    NUKAWORLD_TO_COMMONWEALTH: {
        door: { x: 2592.0, y: -33776.0, z: 0, isGateway: true },
        mapMarker: { x: 3984.0, y: -38312.0, z: 0, isGateway: true, maskedFormId: 152855 }
    },
    COMMONWEALTH_TO_FARHARBOR: {
        door: { x: 82425.47, y: 120477.58, z: 0, isGateway: true },
        mapMarker: { x: 93942.05, y: 102910.21, z: 0, isGateway: true, maskedFormId: 261861 }
    },
    FARHARBOR_TO_COMMONWEALTH: {
        door: { x: 56504.26, y: 32603.35, z: 0, isGateway: true },
        mapMarker: { x: 64825.59, y: 34026.19, z: 0, isGateway: true, maskedFormId: 261859 }
    }
};



export const FAST_TRAVEL_ERROR_MESSAGES: Record<FastTravelStatus, string> = {
    [FastTravelStatus.SUCCESS]: "",
    [FastTravelStatus.PLAYER_DEAD]: "You cannot fast travel while dead.",
    [FastTravelStatus.COMBAT]: "You cannot fast travel while enemies are nearby.",
    [FastTravelStatus.INTERIOR]: "You cannot fast travel from interior locations.",
    [FastTravelStatus.SURVIVAL]: "Fast travel is disabled in Survival Mode.",
    [FastTravelStatus.OVERBURDENED]: "You are carrying too much to fast travel.",
    [FastTravelStatus.QUEST_LOCKED]: "Fast travel is temporarily disabled by active quests.",
    [FastTravelStatus.UNKNOWN_ERROR]: "Fast travel unavailable at this moment."
};
