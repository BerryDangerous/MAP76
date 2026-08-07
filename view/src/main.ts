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
import { SearchPanel } from './components/searchPanel.js';
import { FocusManager } from './systems/focusManager.js';
import { F4SEMapPayload } from './types/payloads.js';
import { DockControlsSystem } from './systems/dockControls.js';
import { KeybindsSystem } from './systems/keybinds.js';

ThemeEngine.initMapConfig();

export function resetUIState(): void {
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    CustomMarkerCard.close();
    closeFastTravelModal();
    QuestCard.close();
    SettlementCard.close();
    MarkerCard.close();
    QuestList.collapse();
    WorkshopList.collapse();
    SearchPanel.collapse();
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
    SearchPanel.init();
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
        if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            e.preventDefault();
        }

        if (KeybindsSystem.isAction(e, 'CLOSE_MAP') && FocusManager.getFocus() === 'MAP') {
            console.log('Closing map via CLOSE_MAP action...');
            resetUIState();
            EngineBridge.closeMap();
            return;
        }

        const handledByFocus = FocusManager.handleKeyDown(e);
        if (handledByFocus) {
            return;
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            console.log('[KeyHandler] Focus is MAP. Closing map via NAV_BACK');
            resetUIState();
            EngineBridge.closeMap();
            return;
        }

        if (FocusManager.getFocus() === 'MAP') {
            const questDockCorner = QuestList.getState().dockCorner;
            const workshopDockCorner = WorkshopList.getState().dockCorner;
            if (DockControlsSystem.isExpandKey(e, questDockCorner)) {
                QuestList.expand();
            } else if (DockControlsSystem.isExpandKey(e, workshopDockCorner)) {
                WorkshopList.expand();
            } else if (DockControlsSystem.isExpandKey(e, SearchPanel.getState().dockCorner)) {
                SearchPanel.expand();
            } else if (KeybindsSystem.isAction(e, 'TAB_NEXT')) {
                console.log('Toggling Supply Lines View...');
                toggleSupplyLinesView();
                applySupplyLinesVisibilityFilter();
            }
        }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Closing map via Escape keyup...');
            resetUIState();
            EngineBridge.closeMap();
            return;
        }
    });
});