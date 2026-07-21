import { loadMarkers } from '../components/markers.js';
import { F4SEMapPayload, FastTravelCheckPayload, FastTravelFailPayload } from '../types/payloads.js';

export const EngineBridge = {
    closeMap() {
        if (typeof window.requestClose === 'function') {
            window.requestClose();
        }
    },
    emitSound(soundDescriptor: string) {
        if (typeof window.triggerEngineSound === 'function') {
            window.triggerEngineSound(soundDescriptor);
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
    }
};

export function initializeF4SEBindings(onDataReceived: (payload: F4SEMapPayload) => void) {
    const processPayload = (jsonString: string) => {
        if (!jsonString || jsonString === "[]") return;
        
        try {
            const payload: F4SEMapPayload = JSON.parse(jsonString);
            onDataReceived(payload);
        } catch (err) {
            console.error(`[Bridge] JSON Processing Failure: ${err}`);
        }
    };

    window.__loadMarkersRegister = (jsonString: string) => {
        console.log(`[Bridge] Pipeline execution running. Stream length: ${jsonString.length}`);
        processPayload(jsonString);
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

    const earlyCache = window.__f4seCache;
    if (earlyCache) {
        console.log(`[Bridge] Processing cached startup array stream. Length: ${earlyCache.length}`);
        processPayload(earlyCache);
        window.__f4seCache = null;
    }

    if (window.MapInterop) {
        window.MapInterop.updateWorkshopStats = (jsonString: string) => {
            console.log("[Interop] Workshop Data received:", jsonString);
        };
        
        window.MapInterop.toggleActiveTheme = (themeName: string) => {
            console.log("[Interop] Theme switch requested:", themeName);
        };
    }
}