import { t } from '@/core/i18n.js';
import { appSettings } from '@/core/settings.js';
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
    | 'SORT'
    | 'CHANGE_LAYOUT';

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

export class KeybindsSystem {
    private static keymap: Record<KeyAction, string[]> = { ...DEFAULT_KEYMAP };
    private static activeModalHandler: ((e: KeyboardEvent) => void) | null = null;
    
    public static isControllerActive: boolean = false;
    public static controllerStyle: number = 0; // 0 = Xbox, 1 = PlayStation

    private static CONTROLLER_GLYPHS_XBOX: Record<string, string> = {
        'Gamepad_A': 'A',
        'Gamepad_B': 'B',
        'Gamepad_X': 'C',
        'Gamepad_Y': 'D',
        'Gamepad_LB': 'G',
        'Gamepad_RB': 'L',
        'Gamepad_LBRB': 'Z',
        'Gamepad_LT': 'I',
        'Gamepad_RT': 'N',
        'Gamepad_Start': 'O',
        'Gamepad_Back': 'E',
        'Gamepad_Up': 'w',
        'Gamepad_Down': 'v',
        'Gamepad_Left': 't',
        'Gamepad_Right': 'u',
        'Gamepad_LS': 'H',
        'Gamepad_RS': 'M',
        'Gamepad_LStick': 'F',
        'Gamepad_RStick': 'K'
    };

    private static CONTROLLER_GLYPHS_PS: Record<string, string> = {
        'Gamepad_A': 'a',
        'Gamepad_B': 'd',
        'Gamepad_X': 'c',
        'Gamepad_Y': 'b',
        'Gamepad_LB': 'g',
        'Gamepad_RB': 'm',
        'Gamepad_LBRB': 'h',
        'Gamepad_LT': 'j',
        'Gamepad_RT': 'o',
        'Gamepad_Start': 'p',
        'Gamepad_Back': 'e',
        'Gamepad_Up': 'w',
        'Gamepad_Down': 'v',
        'Gamepad_Left': 't',
        'Gamepad_Right': 'u',
        'Gamepad_LS': 'f',
        'Gamepad_RS': 'l',
        'Gamepad_LStick': 'i',
        'Gamepad_RStick': 'n'
    };

    private static lastRepeatTime: number = 0;
    private static lastPressedTime: Record<string, number> = {};
    private static lastThumbstickNavTime: number = 0;

    public static setActiveModalHandler(handler: ((e: KeyboardEvent) => void) | null) {
        this.activeModalHandler = handler;
    }

    public static initGlobalListeners(globalFallback: (e: KeyboardEvent) => void): void {
        window.addEventListener('prisma-controller-action', ((e: CustomEvent) => {
            if (!this.isControllerActive) {
                this.isControllerActive = true;
                document.body.classList.add('controller-active');
                window.dispatchEvent(new Event('controlsUpdated'));
            }
            
            const { action, state } = e.detail;
            
            if (state !== 'pressed' && state !== 'repeat' && state !== 'released') return;
            
            const now = Date.now();
            
            if (state === 'pressed') {
                if (this.lastPressedTime[action] && now - this.lastPressedTime[action] < 150) {
                    return;
                }
                this.lastPressedTime[action] = now;
                this.lastRepeatTime = now + 300;
            } else if (state === 'repeat') {
                if (now - this.lastRepeatTime < 100) return;
                this.lastRepeatTime = now;
            }
            
            let keyName = `Gamepad_${action}`;
            
            const syntheticEvent = new KeyboardEvent(state === 'released' ? 'keyup' : 'keydown', {
                key: keyName,
                code: keyName,
                bubbles: true,
                cancelable: true,
                repeat: state === 'repeat'
            });
            const target = document.activeElement || window;
            target.dispatchEvent(syntheticEvent);
        }) as EventListener);

        window.addEventListener('gamepadStateChanged', ((e: CustomEvent<boolean>) => {
            const isGamepad = e.detail;
            if (this.isControllerActive !== isGamepad || this.controllerStyle !== appSettings.controllerStyle) {
                this.isControllerActive = isGamepad;
                this.controllerStyle = appSettings.controllerStyle;
                document.body.classList.toggle('controller-active', isGamepad);
                window.dispatchEvent(new Event('controlsUpdated'));
            }
        }) as EventListener);

        window.addEventListener('settingsUpdated', () => {
            if (this.controllerStyle !== appSettings.controllerStyle) {
                this.controllerStyle = appSettings.controllerStyle;
                window.dispatchEvent(new Event('controlsUpdated'));
            }
        });

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (this.activeModalHandler) {
                this.activeModalHandler(e);
                return;
            }

            const activeEl = document.activeElement as HTMLElement;
            const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

            if (isInputFocused) {
                const navKeys = ['Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown'];
                if (!navKeys.includes(e.key) && !e.key.startsWith('Gamepad_')) {
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
            if (!e.key.startsWith('Gamepad_') && this.isControllerActive) {
                this.isControllerActive = false;
                document.body.classList.remove('controller-active');
                window.dispatchEvent(new Event('controlsUpdated'));
            }

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

    public static isPanelCollapseKey(e: KeyboardEvent, layoutCollapseKey: string): boolean {
        if (e.key === 'Gamepad_B' || e.key === 'Gamepad_Back') return true;
        if (e.key === layoutCollapseKey) return true;
        if (layoutCollapseKey === 'ArrowRight' && e.key === 'Gamepad_Right') return true;
        if (layoutCollapseKey === 'ArrowLeft' && e.key === 'Gamepad_Left') return true;
        if (layoutCollapseKey === 'ArrowDown' && e.key === 'Gamepad_Down') return true;
        if (layoutCollapseKey === 'ArrowUp' && e.key === 'Gamepad_Up') return true;
        return false;
    }

    public static isPanelExpandKey(e: KeyboardEvent, layoutExpandKey: string): boolean {
        if (e.key === layoutExpandKey) return true;
        if (layoutExpandKey === 'ArrowRight' && e.key === 'Gamepad_Right') return true;
        if (layoutExpandKey === 'ArrowLeft' && e.key === 'Gamepad_Left') return true;
        if (layoutExpandKey === 'ArrowDown' && e.key === 'Gamepad_Down') return true;
        if (layoutExpandKey === 'ArrowUp' && e.key === 'Gamepad_Up') return true;
        return false;
    }

    public static getPanelGlyph(rawGlyph: string): string {
        if (this.isControllerActive) {
            return rawGlyph.toLowerCase();
        }
        return rawGlyph;
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
        const primaryKey = keys.find(k => !k.startsWith('Gamepad_')) || keys[0];
        if (primaryKey === ' ') return '[SPACE]';
        if (primaryKey === 'ArrowUp') return '[▲]';
        if (primaryKey === 'ArrowDown') return '[▼]';
        if (primaryKey === 'ArrowLeft') return '[◄]';
        if (primaryKey === 'ArrowRight') return '[►]';
        return `[${primaryKey.toUpperCase()}]`;
    }

    public static getControlText(action: KeyAction, overrideLabel?: string): string {
        const label = overrideLabel || t(DEFAULT_LABELS[action]) || action;
        if (action === 'PAN_MOUSE' && !this.isControllerActive) {
            return `Mouse) ${label}`;
        }
        
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return `?) ${label}`;
        
        if (this.isControllerActive) {
            const gamepadKey = keys.find(k => k.startsWith('Gamepad_'));
            const glyphs = this.controllerStyle === 1 ? this.CONTROLLER_GLYPHS_PS : this.CONTROLLER_GLYPHS_XBOX;
            if (gamepadKey && glyphs[gamepadKey]) {
                const glyph = glyphs[gamepadKey];
                return `${glyph}) ${label}`;
            }
        }

        let primaryKey = keys.find(k => !k.startsWith('Gamepad_')) || keys[0];
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

        if (action === 'PAN_MOUSE' && !this.isControllerActive) {
            return `Mouse) ${labelHtml}`;
        }
        
        const glyphHtml = this.getActionGlyphHtml(action);
        return `${glyphHtml} ${labelHtml}`;
    }

    public static getActionGlyphHtml(action: KeyAction): string {
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return `?)`;
        
        if (this.isControllerActive) {
            const gamepadKey = keys.find(k => k.startsWith('Gamepad_'));
            const glyphs = this.controllerStyle === 1 ? this.CONTROLLER_GLYPHS_PS : this.CONTROLLER_GLYPHS_XBOX;
            if (gamepadKey && glyphs[gamepadKey]) {
                const glyph = glyphs[gamepadKey];
                const isLowercase = glyph === glyph.toLowerCase();
                const fontFamily = isLowercase ? 'ControllerButtonsInverted' : 'ControllerButtons';
                return `<span class="controller-btn-icon" style="font-family: '${fontFamily}'; font-size: 1em; vertical-align: text-bottom; margin-right: 4px; display: inline-block; position: relative; top: 1px;">${glyph}</span>`;
            }
        }

        let primaryKey = keys.find(k => !k.startsWith('Gamepad_')) || keys[0];
        if (primaryKey === ' ') primaryKey = t('controls.keys.space', { defaultValue: 'SPACE' });
        else if (primaryKey === 'Tab') primaryKey = t('controls.keys.tab', { defaultValue: 'TAB' });
        else if (primaryKey === 'Enter') primaryKey = t('controls.keys.enter', { defaultValue: 'ENTER' });
        else if (primaryKey === 'ArrowUp') primaryKey = t('controls.keys.up', { defaultValue: 'UP' });
        else if (primaryKey === 'ArrowDown') primaryKey = t('controls.keys.down', { defaultValue: 'DOWN' });
        else if (primaryKey === 'ArrowLeft') primaryKey = t('controls.keys.left', { defaultValue: 'LEFT' });
        else if (primaryKey === 'ArrowRight') primaryKey = t('controls.keys.right', { defaultValue: 'RIGHT' });
        else if (primaryKey === 'Shift') primaryKey = t('controls.keys.shift', { defaultValue: 'SHIFT' });
        else primaryKey = primaryKey.toUpperCase();
        
        return `${primaryKey})`;
    }
}
