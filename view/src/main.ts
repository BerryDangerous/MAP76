import { mapState } from './core/state.js';
import { initializeF4SEBindings, EngineBridge } from './core/bridge.js';
import { ThemeEngine } from './systems/theme.js';
import { AnimationEngine } from './systems/animation.js';
import { MapViewport } from './components/viewport.js';
import { loadMarkers, applySupplyLinesVisibilityFilter } from './components/markers.js';
import { PopoverManager } from './components/popover.js';
import { toggleSupplyLinesView, setSupplyLinesViewActive } from './components/supplyLines.js';
import { closeCustomMarkerModal } from './components/customMarkerModal.js';
import { closeFastTravelModal } from './components/fastTravelModal.js';
import { InfoCard } from './components/infoCard.js';
import { F4SEMapPayload } from './types/payloads.js';

ThemeEngine.initMapConfig();

export function resetUIState(): void {
    PopoverManager.closeActivePopover();
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    closeCustomMarkerModal();
    closeFastTravelModal();
}

(window as any).resetUIState = resetUIState;

initializeF4SEBindings((payload: F4SEMapPayload) => {
    loadMarkers(payload);
    InfoCard.init(payload.player);
});

window.addEventListener('FrameTick', (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
        InfoCard.update(customEvent.detail);
    }
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

    if (import.meta.env.DEV) {
        import('./dev/mock.js').then(({ initMockData }) => {
            initMockData();
        });
    } else if (window.requestFreshMapData) {
        window.requestFreshMapData(""); 
    }

    window.addEventListener('keydown', (e: KeyboardEvent) => {
        const keyLower = e.key.toLowerCase();
        if (e.key === 'Escape' || e.key === 'Tab' || keyLower === 'm') {
            console.log(`Intercepted close request via Key: (${e.key}). Signaling engine...`);
            resetUIState();
            EngineBridge.closeMap();
        } else if (keyLower === 'c') {
            console.log('Toggling Supply Lines View...');
            toggleSupplyLinesView();
            applySupplyLinesVisibilityFilter();
        }
    });
});