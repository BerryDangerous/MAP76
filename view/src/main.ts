import { mapState } from './core/state.js';
import { initializeF4SEBindings, EngineBridge } from './core/bridge.js';
import { ThemeEngine } from './systems/theme.js';
import { AnimationEngine } from './systems/animation.js';
import { MapViewport } from './components/viewport.js';
import { loadMarkers } from './components/markers.js';
import { PopoverManager } from './components/popover.js';
import { F4SEMapPayload } from './types/payloads.js';

ThemeEngine.initMapConfig();

initializeF4SEBindings((payload: F4SEMapPayload) => {
    loadMarkers(payload);
});

function initCustomCursor() {
    const cursor = document.createElement('img');
    cursor.id = 'custom-map-cursor';
    cursor.src = 'assets/cursor.svg'; 
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e: MouseEvent) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        if (cursor.style.display !== 'block') {
            cursor.style.display = 'block';
        }
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.display = 'none';
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initCustomCursor();
    MapViewport.initEvents();
    PopoverManager.initEvents();
    MapViewport.centerInitialViewport();
    AnimationEngine.startLoop();

    if (window.requestFreshMapData) {
        window.requestFreshMapData(""); 
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Tab' || e.key.toLowerCase() === 'm') {
            console.log(`Intercepted close request via Key: (${e.key}). Signaling engine...`);
            EngineBridge.closeMap();
        }
    });
});