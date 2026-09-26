/// <reference types="vite/client" />

import { MapConfig } from '@/types/map.js';

export { };

declare global {
    interface Window {
        DEFAULT_COMMONWEALTH_CONFIG?: MapConfig;

        GetDiscoveredMapMarkersAsJSON?: (jsonString: string) => void;
        requestFreshMapData?: (arg: string) => void;

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

        PrismaL10N?: {
            locale: string;
            messages: Record<string, string>;
            t: (key: string, vars?: any) => string;
        };

        MapInterop?: {
            updateWorkshopStats?: (jsonString: string) => void;
        };

        loadSettings?: (jsonString: string) => void;
        saveSettings?: (jsonString: string) => void;
        requestSettings?: () => void;

        PrismaInput?: {
            isTextEntryTarget: (node: Node) => boolean;
            isSelectControl: (node: Node) => boolean;
            isFormEntryTarget: (node: Node) => boolean;
            isKeyboardCaptureTarget: (node: Node) => boolean;
        };

        PrismaOSK?: {
            bindHost: (host: HTMLElement) => void;
            open: (element: HTMLInputElement | HTMLTextAreaElement, options?: any) => boolean;
            paste: (text: string) => boolean;
            close: (options?: { commit?: boolean }) => boolean;
            isOpen: () => boolean;
            getTarget: () => HTMLElement | null;
            owns: (element: HTMLElement) => boolean;
            getState: () => any;
            handleButton: (button: string) => boolean;
            render: () => void;
        };
    }
}
