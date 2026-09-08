import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

import { FocusManager, FocusOwner } from '@/systems/focusManager.js';
import { KeybindsSystem, KeyAction } from '@/systems/keybindManager.js';

import { QuestList } from '@/components/QuestsPanel.js';
import { SearchPanel } from '@/components/SearchPanel.js';
import { hasSupplyLines, isSupplyLinesViewActive } from '@/components/SupplyLines.js';

export class ControlBar {
    private static container: HTMLElement | null = null;

    public static init() {
        this.container = document.getElementById('control-bar');
        if (!this.container) {
            console.error('[ControlBar] Container not found (#control-bar)');
            return;
        }

        FocusManager.subscribe((newFocus) => {
            this.render(newFocus);
        });
        
        window.addEventListener('settingsUpdated', () => {
            this.render(FocusManager.getFocus());
        });

        window.addEventListener('controlsUpdated', () => {
            this.render(FocusManager.getFocus());
        });

        this.render(FocusManager.getFocus());
    }

    public static render(focus: FocusOwner) {
        if (!this.container) return;
        
        const activeComponent = FocusManager.getActiveComponent();
        let actions: import('../systems/focusManager.js').ControlActionDef[];
        
        if (activeComponent && activeComponent.getAvailableControls) {
            actions = activeComponent.getAvailableControls();
        } else if (focus === 'MAP') {
            actions = ['OPEN_SETTINGS', 'NAV_BACK', 'PLACE_MARKER', 'ZOOM_IN', 'ZOOM_OUT', 'PAN_MOUSE'];
            
            if (hasSupplyLines()) {
                actions.push('TOGGLE_SUPPLY_LINES');
            }
            if (mapState.lastPayload && mapState.lastPayload.worldspaces && Object.keys(mapState.lastPayload.worldspaces).length > 1) {
                actions.push('PREV_WORLD');
                actions.push('NEXT_WORLD');
            }

            actions.push('CENTER_CAMERA');
        } else {
            actions = ['NAV_BACK'];
        }

        const filteredActions = actions.filter(actionDef => {
            const actionId = typeof actionDef === 'string' ? actionDef : actionDef.action;
            if (actionId === 'PAN_MOUSE' && KeybindsSystem.isControllerActive && focus !== 'MAP') {
                return false;
            }
            if (actionId === 'CENTER_ITEM' && appSettings.focusMarkerOnSelection) {
                return false;
            }
            if (actionId === 'TOGGLE_ACTIVE') {
                if (focus === 'QUEST_LIST') {
                    return !QuestList.isSelectedQuestCompleted();
                }
                if (focus === 'SEARCH_PANEL') {
                    return SearchPanel.isQuestSelected() && !SearchPanel.isSelectedQuestCompleted();
                }
            }
            return true;
        });

        const text = filteredActions.map(actionDef => {
            let actionId: KeyAction;
            let label: string | undefined;
            if (typeof actionDef === 'string') {
                actionId = actionDef as KeyAction;
            } else {
                actionId = actionDef.action;
                label = actionDef.label;
            }

            let html = KeybindsSystem.getControlHtml(
                actionId, 
                label, 
                actionId === 'TOGGLE_SUPPLY_LINES' && isSupplyLinesViewActive()
            );

            return `<span class="control-action" style="display: flex; align-items: center; gap: 4px;">${html}</span>`;
        }).join('');

        this.container.style.gap = '18px';
        this.container.innerHTML = text;
    }
}
