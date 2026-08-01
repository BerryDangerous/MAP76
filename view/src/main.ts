import { mapState } from './core/state.js';
import { initializeF4SEBindings, EngineBridge } from './core/bridge.js';
import { ThemeEngine } from './systems/theme.js';
import { AnimationEngine } from './systems/animation.js';
import { MapViewport } from './components/viewport.js';
import { loadMarkers, applySupplyLinesVisibilityFilter } from './components/markers.js';
import { MarkerInteractionManager } from './components/markerInteraction.js';
import { toggleSupplyLinesView, setSupplyLinesViewActive } from './components/supplyLines.js';
import { CustomMarkerCard } from './components/customMarkerCard.js';
import { closeFastTravelModal } from './components/fastTravelModal.js';
import { InfoCard } from './components/infoCard.js';
import { QuestList } from './components/questList.js';
import { WorkshopList } from './components/workshopList.js';
import { QuestCard } from './components/questCard.js';
import { SettlementCard } from './components/settlementCard.js';
import { MarkerCard } from './components/markerCard.js';
import { FocusManager } from './systems/focusManager.js';
import { F4SEMapPayload } from './types/payloads.js';
import { DockControlsSystem } from './systems/dockControls.js';

ThemeEngine.initMapConfig();

export function resetUIState(): void {
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    CustomMarkerCard.close();
    closeFastTravelModal();
    QuestCard.close();
    SettlementCard.close();
    MarkerCard.close();
}

(window as any).resetUIState = resetUIState;

initializeF4SEBindings((payload: F4SEMapPayload) => {
    loadMarkers(payload);
    InfoCard.init(payload.player);
    QuestList.init();
    WorkshopList.init();
    QuestCard.init();
    SettlementCard.init();
    MarkerCard.init();
    CustomMarkerCard.init();
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
    MarkerInteractionManager.initEvents();
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

        if (e.key === 'Tab' || e.key === 'Escape') {
            e.preventDefault();
        }

        if (keyLower === 'm') {
            console.log('Closing map via M key...');
            resetUIState();
            EngineBridge.closeMap();
            return;
        }

        if (e.key === 'Escape' || e.key === 'Tab') {
            const currentFocus = FocusManager.getFocus();
            if (currentFocus === 'QUEST_CARD') {
                console.log('[KeyHandler] Closing QuestCard via Escape/Tab');
                QuestCard.close();
                FocusManager.setFocus('MAP');
                return;
            } else if (currentFocus === 'QUEST_LIST') {
                console.log('[KeyHandler] Collapsing QuestList via Escape/Tab');
                QuestList.collapse();
                FocusManager.setFocus('MAP');
                return;
            } else if (currentFocus === 'WORKSHOP_LIST') {
                console.log('[KeyHandler] Collapsing WorkshopList via Escape/Tab');
                WorkshopList.collapse();
                FocusManager.setFocus('MAP');
                return;
            } else {
                console.log('[KeyHandler] Focus is MAP. Closing map via Escape/Tab');
                resetUIState();
                EngineBridge.closeMap();
                return;
            }
        }

        const handledByFocus = FocusManager.handleKeyDown(e);
        if (handledByFocus) {
            return;
        }

        if (FocusManager.getFocus() === 'MAP') {
            const questDockCorner = QuestList.getState().dockCorner;
            const workshopDockCorner = WorkshopList.getState().dockCorner;
            if (DockControlsSystem.isExpandKey(e, questDockCorner)) {
                QuestList.expand();
            } else if (DockControlsSystem.isExpandKey(e, workshopDockCorner)) {
                WorkshopList.expand();
            } else if (keyLower === 'c') {
                console.log('Toggling Supply Lines View...');
                toggleSupplyLinesView();
                applySupplyLinesVisibilityFilter();
            }
        }
    });
});