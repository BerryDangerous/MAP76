import { KeyAction } from '@/types/seams.js';

export type { KeyAction };

export const DEFAULT_KEYMAP: Record<KeyAction, string[]> = {
    NAV_UP: ['ArrowUp', 'Gamepad_Up'],
    NAV_DOWN: ['ArrowDown', 'Gamepad_Down'],
    NAV_LEFT: ['ArrowLeft', 'Gamepad_Left'],
    NAV_RIGHT: ['ArrowRight', 'Gamepad_Right'],
    NAV_BACK: ['Tab', 'Gamepad_B'],
    TAB_PREV: ['z', 'Z', 'Gamepad_LB'],
    TAB_NEXT: ['c', 'C', 'Gamepad_RB'],
    SELECT: ['Enter', 'e', 'E', 'Gamepad_A'],
    COLLAPSE: ['ArrowLeft', 'Gamepad_B'],
    CLOSE_MAP: ['m', 'M', 'Gamepad_B', 'Gamepad_Back'],
    PLACE_MARKER: ['Enter', 'Gamepad_A'],
    ZOOM_IN: ['+', '=', 'Gamepad_RT'],
    ZOOM_OUT: ['-', 'Gamepad_LT'],
    PAN_MOUSE: ['Mouse', 'Gamepad_RStick'],
    CENTER_CAMERA: [' ', 'Space', 'Spacebar', 'Gamepad_LS'],
    CENTER_ITEM: [' ', 'Space', 'Spacebar', 'Gamepad_LS'],
    OPEN_SETTINGS: ['z', 'Z', 'Gamepad_Y'],
    OPEN_MENU: ['Esc', 'Gamepad_Start'],
    RESET_DEFAULTS: ['t', 'T', 'Gamepad_X'],
    TOGGLE_ACTIVE: ['t', 'T', 'Gamepad_X'],
    TOGGLE_SUPPLY_LINES: ['c', 'C', 'Gamepad_X'],
    PREV_WORLD: ['<', ',', 'PageUp', 'Gamepad_LB'],
    NEXT_WORLD: ['>', '.', 'PageDown', 'Gamepad_RB'],
    SORT: ['r', 'R', 'Gamepad_Y'],
    CHANGE_LAYOUT: ['Gamepad_LBRB']
};

export const DEFAULT_LABELS: Record<KeyAction, string> = {
    NAV_UP: 'controls.actions.up',
    NAV_DOWN: 'controls.actions.down',
    NAV_LEFT: 'controls.actions.left',
    NAV_RIGHT: 'controls.actions.right',
    NAV_BACK: 'controls.actions.back',
    TAB_PREV: 'controls.actions.prevTab',
    TAB_NEXT: 'controls.actions.nextTab',
    SELECT: 'controls.actions.select',
    COLLAPSE: 'controls.actions.collapse',
    CLOSE_MAP: 'controls.actions.close',
    PLACE_MARKER: 'controls.actions.placeMarker',
    ZOOM_IN: 'controls.actions.zoomIn',
    ZOOM_OUT: 'controls.actions.zoomOut',
    PAN_MOUSE: 'controls.actions.move',
    CENTER_CAMERA: 'controls.actions.centerPlayer',
    CENTER_ITEM: 'controls.actions.centerObjective',
    OPEN_SETTINGS: 'controls.actions.settings',
    OPEN_MENU: 'controls.actions.menu',
    RESET_DEFAULTS: 'controls.actions.defaults',
    TOGGLE_ACTIVE: 'controls.actions.toggleActive',
    TOGGLE_SUPPLY_LINES: 'controls.actions.supplyLines',
    PREV_WORLD: 'controls.actions.prevWorld',
    NEXT_WORLD: 'controls.actions.nextWorld',
    SORT: 'controls.actions.sort',
    CHANGE_LAYOUT: 'controls.actions.layout'
};

const currentKeymap: Record<KeyAction, string[]> = { ...DEFAULT_KEYMAP };

export function isAction(e: KeyboardEvent, action: KeyAction): boolean {
    const allowedKeys = currentKeymap[action];
    if (!allowedKeys) return false;

    const key = e.key;
    const code = e.code;
    const keyCode = e.keyCode;

    return allowedKeys.some((k) => {
        if (k === key) return true;
        if (key && k.toLowerCase() === key.toLowerCase()) return true;
        if (code && k === code) return true;
        // Engine & Platform Constraints: Ultralight WebKit runtime omits standard KeyboardEvent.code
        // or KeyboardEvent.key on certain synthetic and Win32 engine messages. Preserving legacy
        // keyCode fallbacks (27=Escape, 9=Tab, 32=Space) is mandatory to prevent dropped inputs.
        if (k === 'Escape' && (code === 'Escape' || keyCode === 27 || key?.toLowerCase() === 'escape')) return true;
        if (k === 'Tab' && (code === 'Tab' || keyCode === 9 || key?.toLowerCase() === 'tab')) return true;
        if (k === ' ' && (code === 'Space' || keyCode === 32 || key === ' ')) return true;
        return false;
    });
}

export function isPanelCollapseKey(e: KeyboardEvent, layoutCollapseKey: string): boolean {
    if (e.key === 'Gamepad_B' || e.key === 'Gamepad_Back') return true;
    if (e.key === layoutCollapseKey) return true;
    if (layoutCollapseKey === 'ArrowRight' && e.key === 'Gamepad_Right') return true;
    if (layoutCollapseKey === 'ArrowLeft' && e.key === 'Gamepad_Left') return true;
    if (layoutCollapseKey === 'ArrowDown' && e.key === 'Gamepad_Down') return true;
    if (layoutCollapseKey === 'ArrowUp' && e.key === 'Gamepad_Up') return true;
    return false;
}

export function isPanelExpandKey(e: KeyboardEvent, layoutExpandKey: string): boolean {
    if (e.key === layoutExpandKey) return true;
    if (layoutExpandKey === 'ArrowRight' && e.key === 'Gamepad_Right') return true;
    if (layoutExpandKey === 'ArrowLeft' && e.key === 'Gamepad_Left') return true;
    if (layoutExpandKey === 'ArrowDown' && e.key === 'Gamepad_Down') return true;
    if (layoutExpandKey === 'ArrowUp' && e.key === 'Gamepad_Up') return true;
    return false;
}

export function getActionKeys(action: KeyAction): string[] {
    return currentKeymap[action] || [];
}

export function updateKeymap(action: KeyAction, keys: string[]): void {
    currentKeymap[action] = keys;
}
