import { FocusManager, FocusOwner } from '../systems/focusManager.js';
import { KeybindsSystem, KeyAction } from '../systems/keybinds.js';
import { appSettings } from '../core/settings.js';
import { SearchPanel } from './searchPanel.js';
import { QuestList } from './questList.js';
import { hasSupplyLines } from './supplyLines.js';

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

        this.render(FocusManager.getFocus());
    }

    public static render(focus: FocusOwner) {
        if (!this.container) return;
        
        const activeComponent = FocusManager.getActiveComponent();
        let actions: import('../systems/focusManager.js').ControlActionDef[];
        
        if (activeComponent && activeComponent.getAvailableControls) {
            actions = activeComponent.getAvailableControls();
        } else if (focus === 'MAP') {
            actions = ['NAV_BACK', 'PLACE_MARKER', 'ZOOM_IN', 'ZOOM_OUT', 'PAN_MOUSE'];
            
            if (hasSupplyLines()) {
                actions.push('TOGGLE_SUPPLY_LINES');
            }

            actions.push('CENTER_CAMERA');
        } else {
            actions = ['NAV_BACK'];
        }

        const filteredActions = actions.filter(actionDef => {
            const actionId = typeof actionDef === 'string' ? actionDef : actionDef.action;
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
            if (typeof actionDef === 'string') {
                return KeybindsSystem.getControlHtml(actionDef);
            } else {
                return KeybindsSystem.getControlHtml(actionDef.action, actionDef.label);
            }
        }).join('    ');

        this.container.innerHTML = text;
    }
}
