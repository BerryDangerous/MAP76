import { mapState } from './core/state.js';
import { initializeF4SEBindings, EngineBridge } from './core/bridge.js';
import { ThemeEngine } from './systems/theme.js';
import { AnimationEngine } from './systems/animation.js';
import { MapViewport } from './components/viewport.js';
import { loadMarkers, applySupplyLinesVisibilityFilter } from './components/markers.js';
import { MarkerInteractionManager } from './components/markerInteraction.js';
import { toggleSupplyLinesView, setSupplyLinesViewActive, hasSupplyLines } from './components/supplyLines.js';
import { CustomMarkerCard } from './components/customMarkerCard.js';
import { ModalManager } from './systems/modalManager.js';
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
import { SettingsMenu } from './components/SettingsMenu.js';
import { requestSettings } from './core/settings.js';
import { ControlBar } from './components/controlBar.js';
import { InfoBar } from './components/infoBar.js';

ThemeEngine.initMapConfig();

if (navigator.userAgent.includes('Ultralight')) {
    document.body.classList.add('is-ultralight');
}

export function resetUIState(): void {
    setSupplyLinesViewActive(false);
    applySupplyLinesVisibilityFilter();
    CustomMarkerCard.close();
    ModalManager.close();
    QuestCard.close();
    SettlementCard.close();
    MarkerCard.close();
    QuestList.collapse();
    WorkshopList.collapse();
    SearchPanel.collapse();
    SettingsMenu.forceClose();
}

(window as any).resetUIState = resetUIState;

initializeF4SEBindings((payload: F4SEMapPayload) => {
    requestSettings();
    loadMarkers(payload);
    InfoBar.initPlayer(payload.player);
    InfoCard.init(payload.player);
    QuestList.init();
    WorkshopList.init();
    QuestCard.init();
    SettlementCard.init();
    MarkerCard.init();
    CustomMarkerCard.init();
    SearchPanel.init();
    ControlBar.render(FocusManager.getFocus());
});

window.addEventListener('FrameTick', (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
        InfoCard.update(customEvent.detail);
        InfoBar.updateTime(customEvent.detail);
    }
});

window.addEventListener('settingsUpdated', () => {
    if (mapState.lastPayload) {
        loadMarkers(mapState.lastPayload);
    }
    QuestList.render?.();
    WorkshopList.render?.();
    SearchPanel.render?.();
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
    SettingsMenu.init();
    ControlBar.init();
    InfoBar.init();

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
            if (SettingsMenu.isOpen) {
                e.stopPropagation();
                SettingsMenu.handleCloseRequest();
                return;
            }
            console.log('[KeyHandler] Focus is MAP. Closing map via NAV_BACK');
            e.stopPropagation();
            resetUIState();
            EngineBridge.closeMap();
            return;
        }

        if (KeybindsSystem.isAction(e, 'OPEN_SETTINGS')) {
            SettingsMenu.toggle();
            return;
        }

        if (FocusManager.getFocus() === 'MAP') {
            if (KeybindsSystem.isAction(e, 'ZOOM_IN')) {
                MapViewport.performZoom('in', MapViewport.lastMouseX, MapViewport.lastMouseY);
                return;
            }
            if (KeybindsSystem.isAction(e, 'ZOOM_OUT')) {
                MapViewport.performZoom('out', MapViewport.lastMouseX, MapViewport.lastMouseY);
                return;
            }
            if (KeybindsSystem.isAction(e, 'CENTER_CAMERA')) {
                e.preventDefault();
                if (mapState.player.active) {
                    MapViewport.centerOnWorldCoords(mapState.player.x, mapState.player.y);
                }
                return;
            }
            if (KeybindsSystem.isAction(e, 'PLACE_MARKER')) {
                if (mapState.currentPayloadBounds) {
                    const worldCoords = MapViewport.screenToGameCoords(
                        MapViewport.lastMouseX, 
                        MapViewport.lastMouseY, 
                        mapState.currentPayloadBounds
                    );
                    CustomMarkerCard.openForPlacement(worldCoords, { x: MapViewport.lastMouseX, y: MapViewport.lastMouseY });
                    FocusManager.setFocus('CUSTOM_MARKER_CARD');
                }
                return;
            }

            const questDockCorner = QuestList.getState().dockCorner;
            const workshopDockCorner = WorkshopList.getState().dockCorner;
            if (DockControlsSystem.isExpandKey(e, questDockCorner)) {
                QuestList.expand();
            } else if (DockControlsSystem.isExpandKey(e, workshopDockCorner)) {
                WorkshopList.expand();
            } else if (DockControlsSystem.isExpandKey(e, SearchPanel.getState().dockCorner)) {
                SearchPanel.expand();
            } else if (KeybindsSystem.isAction(e, 'TOGGLE_SUPPLY_LINES')) {
                if (hasSupplyLines()) {
                    toggleSupplyLinesView();
                    if (mapState.lastPayload) {
                        loadMarkers(mapState.lastPayload);
                    } else {
                        applySupplyLinesVisibilityFilter();
                    }
                    window.dispatchEvent(new Event('settingsUpdated'));
                }
            }
        }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
        const handledByFocus = FocusManager.handleKeyUp(e);
        if (handledByFocus) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

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