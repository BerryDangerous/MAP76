import { F4SEMapPayload, FastTravelCheckPayload, FastTravelFailPayload } from '@/types/payloads.js';

import { AssetManager } from '@/systems/assetManager.js';
import { loadExternalLocales, initI18n } from '@/core/i18n.js';
import { MapViewport } from '@/systems/viewport.js';

export const EngineBridge = {
    closeMap() {
        if (typeof window.requestClose === 'function') {
            window.requestClose();
        }
    },
    _lastSounds: {} as Record<string, number>,
    emitSound(soundDescriptor: string) {
        if (typeof window.triggerEngineSound === 'function') {
            const now = Date.now();
            if (this._lastSounds[soundDescriptor] && now - this._lastSounds[soundDescriptor] < 50) {
                return;
            }
            this._lastSounds[soundDescriptor] = now;
            const payload = JSON.stringify({ soundName: soundDescriptor });
            window.triggerEngineSound(payload);
        }
    },
    requestFastTravel(formId: number) {
        if (typeof window.requestFastTravel === 'function') {
            const payload = JSON.stringify({ formId });
            window.requestFastTravel(payload);
        } else {
            console.warn(`[Bridge] requestFastTravel not bound by engine. Mocking success for FormID: ${formId}`);
        }
    },
    checkFastTravelConditions(formId: number) {
        if (typeof window.checkFastTravel === 'function') {
            const payload = JSON.stringify({ formId });
            window.checkFastTravel(payload);
        }
    },
    setCustomMarker(x: number, y: number, worldspaceId?: number) {
        if (typeof window.setCustomMarker === 'function') {
            const payload = JSON.stringify({ x, y, worldspaceId });
            window.setCustomMarker(payload);
        }
    },
    removeCustomMarker() {
        if (typeof window.removeCustomMarker === 'function') {
            window.removeCustomMarker('');
        }
    },
    toggleQuestActive(formId: number) {
        if (typeof window.toggleQuestActive === 'function') {
            const payload = JSON.stringify({ formId });
            window.toggleQuestActive(payload);
        } else {
            console.warn(`[Bridge] toggleQuestActive not bound by engine for FormID: ${formId}`);
        }
    },
    makeOnlyQuestActive(formId: number) {
        if (typeof window.makeOnlyQuestActive === 'function') {
            const payload = JSON.stringify({ formId });
            window.makeOnlyQuestActive(payload);
        } else {
            console.warn(`[Bridge] makeOnlyQuestActive not bound by engine for FormID: ${formId}`);
        }
    },
    requestAssetCache(refresh: boolean = false) {
        if (typeof window.requestAssetCache === 'function') {
            window.requestAssetCache(refresh ? "refresh" : "");
        } else {
            console.warn(`[Bridge] requestAssetCache not bound yet.`);
        }
    },
    setMapViewportFocus(hasFocus: boolean) {
        if (typeof window.setMapViewportFocus === 'function') {
            window.setMapViewportFocus(hasFocus ? "true" : "false");
        }
    },
};

export function setCustomMarker(x: number, y: number, worldspaceId?: number): void {
    EngineBridge.setCustomMarker(x, y, worldspaceId);
}

export function removeCustomMarker(): void {
    EngineBridge.removeCustomMarker();
}

export function toggleQuestActive(formId: number): void {
    EngineBridge.toggleQuestActive(formId);
}

export function makeOnlyQuestActive(formId: number): void {
    EngineBridge.makeOnlyQuestActive(formId);
}

export function setMapViewportFocus(hasFocus: boolean): void {
    EngineBridge.setMapViewportFocus(hasFocus);
}

export function initializeF4SEBindings(onDataReceived: (payload: F4SEMapPayload) => void) {
    let isAssetsLoaded = false;
    let isLocalesLoaded = false;
    let pendingPayload: F4SEMapPayload | null = null;

    const processPayload = (jsonString: string) => {
        if (!jsonString || jsonString === "[]") return;
        
        try {
            const payload: F4SEMapPayload = JSON.parse(jsonString);
            if (!isAssetsLoaded || !isLocalesLoaded) {
                console.log(`[Bridge] Assets or Locales not loaded yet. Buffering payload.`);
                pendingPayload = payload;
                return;
            }
            onDataReceived(payload);
        } catch (err) {
            console.error(`[Bridge] JSON Processing Failure: ${err}`);
        }
    };

    window.__loadMarkersRegister = (jsonString: string) => {
        console.log(`[Bridge] Pipeline execution running. Stream length: ${jsonString.length}`);
        processPayload(jsonString);
    };

    window.__loadAssetsRegister = (jsonString: string) => {
        try {
            const payload = JSON.parse(jsonString);
            AssetManager.init(payload);
            isAssetsLoaded = true;
            if (pendingPayload && isLocalesLoaded) {
                console.log(`[Bridge] Assets loaded. Processing buffered payload.`);
                onDataReceived(pendingPayload);
                pendingPayload = null;
            }
        } catch (err) {
            console.error(`[Bridge] Asset Payload JSON Processing Failure: ${err}`);
        }
    };

    window.__loadLocalesRegister = (jsonString: string) => {
        try {
            const payload = JSON.parse(jsonString);
            loadExternalLocales(payload.locales);
            initI18n(payload.gameLanguage).then(() => {
                isLocalesLoaded = true;
                if (pendingPayload && isAssetsLoaded) {
                    console.log(`[Bridge] Locales loaded. Processing buffered payload.`);
                    onDataReceived(pendingPayload);
                    pendingPayload = null;
                }
            });
        } catch (err) {
            console.error(`[Bridge] Locale Payload JSON Processing Failure: ${err}`);
        }
    };

    window.onFastTravelFailed = (jsonString: string) => {
        try {
            const data: FastTravelFailPayload = JSON.parse(jsonString);
            window.dispatchEvent(new CustomEvent('FastTravelFailed', { detail: data }));
        } catch (err) {
            console.error("[Bridge] Failed to parse onFastTravelFailed payload", err);
        }
    };

    window.onFastTravelCheckResult = (jsonString: string) => {
        try {
            const data: FastTravelCheckPayload = JSON.parse(jsonString);
            window.dispatchEvent(new CustomEvent('FastTravelCheckResult', { detail: data }));
        } catch (err) {
            console.error("[Bridge] Failed to parse onFastTravelCheckResult payload", err);
        }
    };

    window.onFrameTick = (jsonString: string) => {
        try {
            const data = JSON.parse(jsonString);
            window.dispatchEvent(new CustomEvent('FrameTick', { detail: data }));
        } catch (err) {
            console.error("[Bridge] Failed to parse onFrameTick payload", err);
        }
    };

    const earlyCache = window.__f4seCache;
    if (earlyCache) {
        console.log(`[Bridge] Processing cached startup array stream. Length: ${earlyCache.length}`);
        processPayload(earlyCache);
        window.__f4seCache = null;
    }

    const earlyAssetCache = window.__f4seAssetCache;
    if (earlyAssetCache) {
        console.log(`[Bridge] Processing cached startup asset stream. Length: ${earlyAssetCache.length}`);
        window.__loadAssetsRegister!(earlyAssetCache);
        window.__f4seAssetCache = null;
    }

    const earlyLocaleCache = window.__f4seLocaleCache;
    if (earlyLocaleCache) {
        console.log(`[Bridge] Processing cached startup locale stream. Length: ${earlyLocaleCache.length}`);
        window.__loadLocalesRegister!(earlyLocaleCache);
        window.__f4seLocaleCache = null;
    }

    if (window.MapInterop) {
        window.MapInterop.updateWorkshopStats = (jsonString: string) => {
            console.log("[Interop] Workshop Data received:", jsonString);
        };
    }

    window.__panViewport = (dx: number, dy: number) => {
        MapViewport.panBy(dx, dy);
    };
}