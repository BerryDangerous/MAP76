import { FastTravelStatus } from '@/types/map.js';
import { FrameTickPayload } from '@/types/payloads.js';

import { mockPayload, mockAssetPayload } from '@/dev/mockData.js';

export function initMockData(): void {
    console.log('[DevMode] Initializing Mock Data Sandbox...');

    window.loadAssets = (jsonString: string) => {
        if (typeof window.__loadAssetsRegister === 'function') {
            window.__loadAssetsRegister(jsonString);
        }
    };

    window.loadLocales = (jsonString: string) => {
        if (typeof window.__loadLocalesRegister === 'function') {
            window.__loadLocalesRegister(jsonString);
        }
    };

    const emitPayload = () => {
        const json = JSON.stringify(mockPayload);
        if (typeof window.__loadMarkersRegister === 'function') {
            window.__loadMarkersRegister(json);
        } else if (typeof window.loadMarkers === 'function') {
            window.loadMarkers(json);
        } else {
            window.__f4seCache = json;
        }
    };

    window.requestFreshMapData = () => {
        console.log('[DevMode] requestFreshMapData triggered. Emitting mock payload.');
        emitPayload();
    };

    window.requestAssetCache = async () => {
        console.log('[DevMode] requestAssetCache triggered. Fetching SVGs and JSONs dynamically...');

        const variants = ['default', 'default-vector', 'satellite4k', 'satellite8k'];
        const worldspaces = Object.values(mockPayload.worldspaces || {}).map(w => w.editorID.toLowerCase());
        
        const pathsToTry = [
            { dir: 'assets/maps', file: 'blank' }
        ];

        for (const ws of worldspaces) {
            for (const variant of variants) {
                pathsToTry.push({ dir: `assets/maps/${ws}`, file: variant });
            }
        }

        for (const { dir, file } of pathsToTry) {
            const jsonPath = `${dir}/${file}.json`;
            try {
                const res = await fetch(`/${jsonPath}`);
                if (res.ok) {
                    const parsed = await res.json();
                    for (const [key, val] of Object.entries(parsed)) {
                        mockAssetPayload.mapConfigs[key] = {
                            ...(val as any),
                            configID: key
                        };
                    }
                }
            } catch (e) {
            }
        }

        for (const { dir, file } of pathsToTry) {
            const svgPath = `${dir}/${file}.svg`;
            try {
                const res = await fetch(`/${svgPath}`);
                if (res.ok) {
                    mockAssetPayload.assetCache[svgPath] = await res.text();
                }
            } catch (e) {
            }
        }

        try {
            const svgListRes = await fetch('/dev/svg-list.json');
            if (svgListRes.ok) {
                const svgFiles = await svgListRes.json();
                for (const file of svgFiles) {
                    try {
                        const res = await fetch(`/${file}`);
                        if (res.ok) {
                            mockAssetPayload.assetCache[file] = await res.text();
                        }
                    } catch (e) {
                    }
                }
            }
        } catch (e) {
        }

        try {
            let overrideFiles: string[] = [];
            try {
                const listRes = await fetch('/dev/overrides-list.json');
                if (listRes.ok) overrideFiles = await listRes.json();
            } catch (e) {
            }

            const overrideByFormId = new Map<number, string>();

            for (const filename of overrideFiles) {
                try {
                    const res = await fetch(`/assets/icons/location/overrides/${filename}`);
                    if (!res.ok) continue;
                    const overrideData = await res.json();
                    const markerOverrides = overrideData?.markerOverrides;
                    if (!markerOverrides) continue;

                    for (const entries of Object.values(markerOverrides) as Array<Array<{ localFormId: number; icon: string }>>) {
                        for (const entry of entries) {
                            if (entry.localFormId !== undefined && entry.icon) {
                                overrideByFormId.set(entry.localFormId, entry.icon);
                            }
                        }
                    }
                    console.log(`[DevMode] Loaded icon overrides from ${filename}`);
                } catch (e) {
                    console.warn(`[DevMode] Failed to process override file ${filename}:`, e);
                }
            }

            if (overrideByFormId.size > 0) {
                let applied = 0;
                for (const marker of mockPayload.markers) {
                    const icon = overrideByFormId.get(marker.formId)
                        ?? (marker.localFormId !== undefined ? overrideByFormId.get(marker.localFormId) : undefined);
                    if (icon) {
                        (marker as any).customIcon = icon;
                        applied++;
                    }
                }
                console.log(`[DevMode] Applied ${applied} icon override(s) to mock markers.`);
            }
        } catch (e) {
            console.warn('[DevMode] Failed to apply icon overrides:', e);
        }

        const json = JSON.stringify(mockAssetPayload);
        if (typeof window.loadAssets === 'function') {
            window.loadAssets(json);
        }

        const localeJson = JSON.stringify({
            gameLanguage: 'en',
            locales: {}
        });
        if (typeof window.loadLocales === 'function') {
            window.loadLocales(localeJson);
        }

        emitPayload();
    };

    window.saveSettings = (jsonString: string) => {
        console.log('[DevMode] saveSettings called:', jsonString);
        localStorage.setItem('map76_settings', jsonString);
    };

    window.requestSettings = () => {
        console.log('[DevMode] requestSettings called');
        const saved = localStorage.getItem('map76_settings');
        if (saved && typeof (window as any).loadSettings === 'function') {
            (window as any).loadSettings(saved);
        } else if (typeof (window as any).loadSettings === 'function') {
            (window as any).loadSettings("{}");
        }
    };

    window.requestFastTravel = (payloadString: string) => {
        console.log('[DevMode] requestFastTravel called with:', payloadString);
    };

    window.checkFastTravel = (payloadString: string) => {
        console.log('[DevMode] checkFastTravel called with:', payloadString);
        if (window.onFastTravelCheckResult) {
            const statuses = [
                FastTravelStatus.SUCCESS,
                FastTravelStatus.SUCCESS,
                FastTravelStatus.PLAYER_DEAD,
                FastTravelStatus.COMBAT,
                FastTravelStatus.INTERIOR,
                FastTravelStatus.SURVIVAL,
                FastTravelStatus.OVERBURDENED,
            ];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            setTimeout(() => {
                window.onFastTravelCheckResult!(JSON.stringify({ status: randomStatus }));
            }, 50);
        }
    };

    window.setCustomMarker = (payloadString: string) => {
        console.log('[DevMode] setCustomMarker called with:', payloadString);
        try {
            const data = JSON.parse(payloadString);
            mockPayload.custom_marker = {
                worldspace: 60,
                x: data.x,
                y: data.y
            };
            emitPayload();
        } catch (e) {
            console.error('[DevMode] Failed to parse setCustomMarker payload', e);
        }
    };

    window.removeCustomMarker = () => {
        console.log('[DevMode] removeCustomMarker called');
        mockPayload.custom_marker = null;
        emitPayload();
    };

    window.requestClose = () => {
        console.log('[DevMode] Map close requested');
    };

    window.triggerEngineSound = (soundName: string) => {
        console.log('[DevMode] Sound triggered:', soundName);
    };

    let gameHour = 14.5;
    let gameDay = 23;
    let gameMonth = 10;
    let gameYear = 2287;
    let tickCount = 0;

    setInterval(() => {
        tickCount++;
        if (tickCount % 2 === 0) {
            gameHour += 1 / 180;
            if (gameHour >= 24) {
                gameHour = 0;
                gameDay += 1;
                if (gameDay > 30) {
                    gameDay = 1;
                    gameMonth += 1;
                    if (gameMonth > 12) {
                        gameMonth = 1;
                        gameYear += 1;
                    }
                }
            }
        }

        const tickPayload: FrameTickPayload = {
            hour: gameHour,
            day: gameDay,
            month: gameMonth,
            year: gameYear
        };

        if (window.onFrameTick) {
            window.onFrameTick(JSON.stringify(tickPayload));
        } else {
            window.dispatchEvent(new CustomEvent('FrameTick', { detail: tickPayload }));
        }
    }, 1000);

    emitPayload();
}
