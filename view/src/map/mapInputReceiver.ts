import { ControlActionDef, FocusOwner, InputReceiver, InputRouter, KeyAction } from '@/input/index.js';
import { domainState } from '@/core/state/index.js';
import { LayoutManager } from '@/systems/layoutManager.js';
import { SoundService } from '@/services/soundService.js';
import { QuestList, LocationsList, SearchPanel } from '@/overlays/index.js';
import { SettingsMenu } from '@/components/SettingsMenu.js';
import { mapSurface } from './mapSurface.js';

const COMMONWEALTH_FORM_ID = 60;
const NUKA_WORLD_FORM_ID = 100673807;
const FAR_HARBOR_FORM_ID = 50334479;

const WORLDSPACE_SORT_PRIORITY: Record<number, number> = {
    [COMMONWEALTH_FORM_ID]: 0,
    [NUKA_WORLD_FORM_ID]: 1,
    [FAR_HARBOR_FORM_ID]: 2
};

export class MapInputReceiver implements InputReceiver {
    public readonly id = FocusOwner.MAP;

    private static readonly ACTION_EXPAND_KEYS: Partial<Record<KeyAction, string>> = {
        [KeyAction.NAV_UP]: 'ArrowUp',
        [KeyAction.NAV_DOWN]: 'ArrowDown',
        [KeyAction.NAV_LEFT]: 'ArrowLeft',
        [KeyAction.NAV_RIGHT]: 'ArrowRight'
    };

    public handleAction(action: KeyAction): boolean {
        switch (action) {
            case KeyAction.NAV_BACK:
            case KeyAction.CLOSE_MAP:
                InputRouter.triggerCloseMap();
                return true;

            case KeyAction.ZOOM_IN:
                SoundService.playMapZoom();
                mapSurface.setZoomHold('in');
                return true;

            case KeyAction.ZOOM_OUT:
                SoundService.playMapZoom();
                mapSurface.setZoomHold('out');
                return true;

            case KeyAction.CENTER_CAMERA:
                SoundService.playMapZoom();
                if (domainState.player) {
                    mapSurface.saveCurrentWorldViewport();
                    domainState.setSelectedWorldspace(null);
                    if (domainState.lastPayload) {
                        mapSurface.render(true);
                    }
                    if (domainState.player.active) {
                        mapSurface.centerOnWorldCoords(domainState.player.x, domainState.player.y);
                    }
                }
                return true;

            case KeyAction.SELECT:
                return mapSurface.activateHoveredMarker();

            case KeyAction.PLACE_MARKER:
                mapSurface.triggerCustomMarkerPlacement();
                return true;

            case KeyAction.OPEN_SETTINGS:
                SettingsMenu.toggle();
                return true;

            case KeyAction.TOGGLE_SUPPLY_LINES:
                if (mapSurface.hasSupplyLines()) {
                    mapSurface.toggleSupplyLines();
                    if (domainState.lastPayload) {
                        mapSurface.render();
                    }
                    window.dispatchEvent(new Event('settingsUpdated'));
                }
                return true;

            case KeyAction.PREV_WORLD:
            case KeyAction.NEXT_WORLD:
                return this.cycleWorldspace(action === KeyAction.PREV_WORLD);

            case KeyAction.NAV_UP:
            case KeyAction.NAV_DOWN:
            case KeyAction.NAV_LEFT:
            case KeyAction.NAV_RIGHT:
                return this.handlePanelExpansion(action);

            default:
                return false;
        }
    }

    public handleActionRelease(action: KeyAction): boolean {
        if (action === KeyAction.ZOOM_IN || action === KeyAction.ZOOM_OUT) {
            mapSurface.setZoomHold(null);
            return true;
        }
        return false;
    }

    public getAvailableControls(): ControlActionDef[] {
        const actions: ControlActionDef[] = [
            KeyAction.OPEN_SETTINGS,
            KeyAction.NAV_BACK,
            KeyAction.PLACE_MARKER,
            KeyAction.ZOOM_IN,
            KeyAction.ZOOM_OUT,
            KeyAction.PAN_MOUSE
        ];

        if (mapSurface.hasSupplyLines()) {
            actions.push(KeyAction.TOGGLE_SUPPLY_LINES);
        }

        if (domainState.lastPayload?.worldspaces && Object.keys(domainState.lastPayload.worldspaces).length > 1) {
            actions.push(KeyAction.PREV_WORLD);
            actions.push(KeyAction.NEXT_WORLD);
        }

        actions.push(KeyAction.CENTER_CAMERA);
        return actions;
    }

    private cycleWorldspace(isPrev: boolean): boolean {
        if (!domainState.lastPayload || !domainState.lastPayload.worldspaces) return false;

        const wsKeys = Object.keys(domainState.lastPayload.worldspaces).map(k => parseInt(k, 10));
        if (wsKeys.length <= 1) return false;

        wsKeys.sort((a, b) => {
            const pA = WORLDSPACE_SORT_PRIORITY[a] ?? 3;
            const pB = WORLDSPACE_SORT_PRIORITY[b] ?? 3;
            if (pA !== pB) return pA - pB;

            const nameA = domainState.lastPayload!.worldspaces![a].fullName.toLowerCase();
            const nameB = domainState.lastPayload!.worldspaces![b].fullName.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const currentIdx = wsKeys.indexOf(domainState.getActiveWorldspaceID());
        let nextIdx = 0;
        if (isPrev) {
            nextIdx = currentIdx > 0 ? currentIdx - 1 : wsKeys.length - 1;
        } else {
            nextIdx = currentIdx < wsKeys.length - 1 ? currentIdx + 1 : 0;
        }

        SoundService.playMapOpen();
        mapSurface.switchWorldspace(wsKeys[nextIdx]);
        return true;
    }

    private handlePanelExpansion(action: KeyAction): boolean {
        const expandKey = MapInputReceiver.ACTION_EXPAND_KEYS[action];
        if (!expandKey) return false;

        const panels = [
            { panel: QuestList, corner: QuestList.getState().dockCorner },
            { panel: LocationsList, corner: LocationsList.getState().dockCorner },
            { panel: SearchPanel, corner: SearchPanel.getState().dockCorner }
        ];

        for (const { panel, corner } of panels) {
            const config = LayoutManager.getCornerConfig(corner);
            if (config.expandKey === expandKey) {
                panel.expand();
                return true;
            }
        }

        return false;
    }
}

export const mapInputReceiver = new MapInputReceiver();
