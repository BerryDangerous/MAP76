/// <reference types="vite/client" />

import { MapConfig } from '@/types/map.js';

export { };

declare global {
    interface Window {
        DEFAULT_COMMONWEALTH_CONFIG?: MapConfig;

        GetDiscoveredMapMarkersAsJSON?: (jsonString: string) => void;
        requestFreshMapData?: (arg: string) => void;
        setMapViewportFocus?: (arg: string) => void;

        requestClose?: () => void;
        triggerEngineSound?: (soundName: string) => void;

        requestFastTravel?: (payloadString: string) => void;
        checkFastTravel?: (payloadString: string) => void;

        setCustomMarker?: (payloadString: string) => void;
        removeCustomMarker?: (arg: string) => void;

        toggleQuestActive?: (payloadString: string) => void;
        makeOnlyQuestActive?: (payloadString: string) => void;

        onFastTravelFailed?: (jsonString: string) => void;
        onFastTravelCheckResult?: (jsonString: string) => void;
        onFrameTick?: (jsonString: string) => void;

        loadMarkers?: (jsonString: string) => void;
        __loadMarkersRegister?: (jsonString: string) => void;
        __f4seCache?: string | null;

        loadAssets?: (jsonString: string) => void;
        __loadAssetsRegister?: (jsonString: string) => void;
        __f4seAssetCache?: string | null;
        requestAssetCache?: (arg: string) => void;

        loadLocales?: (jsonString: string) => void;
        __loadLocalesRegister?: (jsonString: string) => void;
        __f4seLocaleCache?: string | null;

        MapInterop?: {
            updateWorkshopStats?: (jsonString: string) => void;
        };

        __panViewport?: (dx: number, dy: number) => void;

        loadSettings?: (jsonString: string) => void;
        saveSettings?: (jsonString: string) => void;
        requestSettings?: () => void;
    }
}
