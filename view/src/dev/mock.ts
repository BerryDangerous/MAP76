import { FastTravelStatus } from '../types/map.js';
import { FrameTickPayload } from '../types/payloads.js';
import { mockPayload } from './mockData.js';

export function initMockData(): void {
    console.log('[DevMode] Initializing Mock Data Sandbox...');

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

    window.saveSettings = (jsonString: string) => {
        console.log('[DevMode] saveSettings called:', jsonString);
        localStorage.setItem('papermap_settings', jsonString);
    };

    window.requestSettings = () => {
        console.log('[DevMode] requestSettings called');
        const saved = localStorage.getItem('papermap_settings');
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
