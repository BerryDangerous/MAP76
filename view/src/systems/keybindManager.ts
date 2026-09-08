import { t } from '@/core/i18n.js';
import { FocusManager } from './focusManager.js';
export type KeyAction =
    | 'NAV_UP'
    | 'NAV_DOWN'
    | 'NAV_LEFT'
    | 'NAV_RIGHT'
    | 'NAV_BACK'
    | 'TAB_PREV'
    | 'TAB_NEXT'
    | 'SELECT'
    | 'COLLAPSE'
    | 'CLOSE_MAP'
    | 'PLACE_MARKER'
    | 'ZOOM_IN'
    | 'ZOOM_OUT'
    | 'PAN_MOUSE'
    | 'CENTER_CAMERA'
    | 'CENTER_ITEM'
    | 'OPEN_SETTINGS'
    | 'OPEN_MENU'
    | 'RESET_DEFAULTS'
    | 'TOGGLE_ACTIVE'
    | 'TOGGLE_SUPPLY_LINES'
    | 'PREV_WORLD'
    | 'NEXT_WORLD'
    | 'SORT';

export const DEFAULT_KEYMAP: Record<KeyAction, string[]> = {
    NAV_UP: ['ArrowUp'],
    NAV_DOWN: ['ArrowDown'],
    NAV_LEFT: ['ArrowLeft'],
    NAV_RIGHT: ['ArrowRight'],
    NAV_BACK: ['Tab'],
    TAB_PREV: ['z', 'Z'],
    TAB_NEXT: ['c', 'C'],
    SELECT: ['Enter', 'e', 'E'],
    COLLAPSE: ['ArrowLeft'],
    CLOSE_MAP: ['m', 'M'],
    PLACE_MARKER: ['Enter'],
    ZOOM_IN: ['+', '='],
    ZOOM_OUT: ['-'],
    PAN_MOUSE: ['Mouse'], // Pseudo-key for the mouse
    CENTER_CAMERA: [' ', 'Space', 'Spacebar'],
    CENTER_ITEM: ['Shift'],
    OPEN_SETTINGS: ['z', 'Z'],
    OPEN_MENU: ['Esc'],
    RESET_DEFAULTS: ['t', 'T'],
    TOGGLE_ACTIVE: ['t', 'T'],
    TOGGLE_SUPPLY_LINES: ['c', 'C'],
    PREV_WORLD: ['<', ',', 'PageUp'],
    NEXT_WORLD: ['>', '.', 'PageDown'],
    SORT: ['r', 'R']
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
    SORT: 'controls.actions.sort'
};

export class KeybindsSystem {
    private static keymap: Record<KeyAction, string[]> = { ...DEFAULT_KEYMAP };
    private static activeModalHandler: ((e: KeyboardEvent) => void) | null = null;

    public static setActiveModalHandler(handler: ((e: KeyboardEvent) => void) | null) {
        this.activeModalHandler = handler;
    }

    public static initGlobalListeners(globalFallback: (e: KeyboardEvent) => void): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (this.activeModalHandler) {
                this.activeModalHandler(e);
                return;
            }

            const activeEl = document.activeElement as HTMLElement;
            const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

            if (isInputFocused) {
                const navKeys = ['Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown'];
                if (!navKeys.includes(e.key)) {
                    return;
                }
            }

            const handledByFocus = FocusManager.handleKeyDown(e);
            if (handledByFocus) {
                e.preventDefault();
                return;
            }

            if (globalFallback) {
                globalFallback(e);
            }

            e.preventDefault();
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            const handledByFocus = FocusManager.handleKeyUp(e);
            if (handledByFocus) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (globalFallback) {
                globalFallback(e);
            }
        });
    }

    public static isAction(e: KeyboardEvent, action: KeyAction): boolean {
        const allowedKeys = this.keymap[action];
        if (!allowedKeys) return false;

        const key = e.key;
        const code = e.code;
        const keyCode = e.keyCode;

        return allowedKeys.some(k => {
            if (k === key) return true;
            if (key && k.toLowerCase() === key.toLowerCase()) return true;
            if (code && k === code) return true;
            if (k === 'Escape' && (code === 'Escape' || keyCode === 27 || key?.toLowerCase() === 'escape')) return true;
            if (k === 'Tab' && (code === 'Tab' || keyCode === 9 || key?.toLowerCase() === 'tab')) return true;
            if (k === ' ' && (code === 'Space' || keyCode === 32 || key === ' ')) return true;
            return false;
        });
    }

    public static getActionKeys(action: KeyAction): string[] {
        return this.keymap[action] || [];
    }

    public static updateKeymap(action: KeyAction, keys: string[]): void {
        this.keymap[action] = keys;
    }

    public static getBadgeText(action: KeyAction): string {
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return '';
        const primaryKey = keys[0];
        if (primaryKey === ' ') return '[SPACE]';
        if (primaryKey === 'ArrowUp') return '[▲]';
        if (primaryKey === 'ArrowDown') return '[▼]';
        if (primaryKey === 'ArrowLeft') return '[◄]';
        if (primaryKey === 'ArrowRight') return '[►]';
        return `[${primaryKey.toUpperCase()}]`;
    }

    public static getControlText(action: KeyAction, overrideLabel?: string): string {
        const label = overrideLabel || t(DEFAULT_LABELS[action]) || action;
        if (action === 'PAN_MOUSE') {
            return `Mouse) ${label}`;
        }
        
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return `?) ${label}`;
        
        let primaryKey = keys[0];
        if (primaryKey === ' ') primaryKey = t('controls.keys.space', { defaultValue: 'SPACE' });
        else if (primaryKey === 'Tab') primaryKey = t('controls.keys.tab', { defaultValue: 'TAB' });
        else if (primaryKey === 'Enter') primaryKey = t('controls.keys.enter', { defaultValue: 'ENTER' });
        else if (primaryKey === 'ArrowUp') primaryKey = t('controls.keys.up', { defaultValue: 'UP' });
        else if (primaryKey === 'ArrowDown') primaryKey = t('controls.keys.down', { defaultValue: 'DOWN' });
        else if (primaryKey === 'ArrowLeft') primaryKey = t('controls.keys.left', { defaultValue: 'LEFT' });
        else if (primaryKey === 'ArrowRight') primaryKey = t('controls.keys.right', { defaultValue: 'RIGHT' });
        else if (primaryKey === 'Shift') primaryKey = t('controls.keys.shift', { defaultValue: 'SHIFT' });
        else primaryKey = primaryKey.toUpperCase();
        
        return `${primaryKey}) ${label}`;
    }

    public static getControlHtml(action: KeyAction, overrideLabel?: string, isActive?: boolean): string {
        const label = overrideLabel || t(DEFAULT_LABELS[action]) || action;
        let labelHtml = `<b>${label}</b>`;
        if (isActive) {
            labelHtml = `<span style="text-decoration: underline;">${labelHtml}</span>`;
        }

        if (action === 'PAN_MOUSE') {
            return `Mouse) ${labelHtml}`;
        }
        
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return `?) <b>${label}</b>`;
        
        let primaryKey = keys[0];
        if (primaryKey === ' ') primaryKey = t('controls.keys.space', { defaultValue: 'SPACE' });
        else if (primaryKey === 'Tab') primaryKey = t('controls.keys.tab', { defaultValue: 'TAB' });
        else if (primaryKey === 'Enter') primaryKey = t('controls.keys.enter', { defaultValue: 'ENTER' });
        else if (primaryKey === 'ArrowUp') primaryKey = t('controls.keys.up', { defaultValue: 'UP' });
        else if (primaryKey === 'ArrowDown') primaryKey = t('controls.keys.down', { defaultValue: 'DOWN' });
        else if (primaryKey === 'ArrowLeft') primaryKey = t('controls.keys.left', { defaultValue: 'LEFT' });
        else if (primaryKey === 'ArrowRight') primaryKey = t('controls.keys.right', { defaultValue: 'RIGHT' });
        else if (primaryKey === 'Shift') primaryKey = t('controls.keys.shift', { defaultValue: 'SHIFT' });
        else primaryKey = primaryKey.toUpperCase();
        
        return `${primaryKey}) ${labelHtml}`;
    }
}
