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
    | 'RESET_DEFAULTS'
    | 'TOGGLE_ACTIVE'
    | 'TOGGLE_SUPPLY_LINES';

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
    RESET_DEFAULTS: ['t', 'T'],
    TOGGLE_ACTIVE: ['t', 'T'],
    TOGGLE_SUPPLY_LINES: ['c', 'C']
};

export const DEFAULT_LABELS: Record<KeyAction, string> = {
    NAV_UP: 'UP',
    NAV_DOWN: 'DOWN',
    NAV_LEFT: 'LEFT',
    NAV_RIGHT: 'RIGHT',
    NAV_BACK: 'BACK',
    TAB_PREV: 'PREV TAB',
    TAB_NEXT: 'NEXT TAB',
    SELECT: 'SELECT',
    COLLAPSE: 'COLLAPSE',
    CLOSE_MAP: 'CLOSE',
    PLACE_MARKER: 'PLACE MARKER',
    ZOOM_IN: 'ZOOM IN',
    ZOOM_OUT: 'ZOOM OUT',
    PAN_MOUSE: 'MOVE',
    CENTER_CAMERA: 'CENTER PLAYER',
    CENTER_ITEM: 'CENTER OBJECTIVE',
    OPEN_SETTINGS: 'SETTINGS',
    RESET_DEFAULTS: 'DEFAULTS',
    TOGGLE_ACTIVE: 'TOGGLE ACTIVE',
    TOGGLE_SUPPLY_LINES: 'SUPPLY LINES'
};

export class KeybindsSystem {
    private static keymap: Record<KeyAction, string[]> = { ...DEFAULT_KEYMAP };

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
        const label = overrideLabel || DEFAULT_LABELS[action] || action;
        if (action === 'PAN_MOUSE') {
            return `Mouse) ${label}`;
        }
        
        const keys = this.keymap[action];
        if (!keys || keys.length === 0) return `?) ${label}`;
        
        let primaryKey = keys[0];
        if (primaryKey === ' ') primaryKey = 'SPACE';
        else if (primaryKey === 'Tab') primaryKey = 'TAB';
        else if (primaryKey === 'Enter') primaryKey = 'ENTER';
        else if (primaryKey === 'ArrowUp') primaryKey = 'UP';
        else if (primaryKey === 'ArrowDown') primaryKey = 'DOWN';
        else if (primaryKey === 'ArrowLeft') primaryKey = 'LEFT';
        else if (primaryKey === 'ArrowRight') primaryKey = 'RIGHT';
        else primaryKey = primaryKey.toUpperCase();
        
        return `${primaryKey}) ${label}`;
    }

    public static getControlHtml(action: KeyAction, overrideLabel?: string, isActive?: boolean): string {
        const label = overrideLabel || DEFAULT_LABELS[action] || action;
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
        if (primaryKey === ' ') primaryKey = 'SPACE';
        else if (primaryKey === 'Tab') primaryKey = 'TAB';
        else if (primaryKey === 'Enter') primaryKey = 'ENTER';
        else if (primaryKey === 'ArrowUp') primaryKey = 'UP';
        else if (primaryKey === 'ArrowDown') primaryKey = 'DOWN';
        else if (primaryKey === 'ArrowLeft') primaryKey = 'LEFT';
        else if (primaryKey === 'ArrowRight') primaryKey = 'RIGHT';
        else primaryKey = primaryKey.toUpperCase();
        
        return `${primaryKey}) ${labelHtml}`;
    }
}
