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
    | 'TOGGLE_TRACKING'
    | 'CLOSE_MAP';

export const DEFAULT_KEYMAP: Record<KeyAction, string[]> = {
    NAV_UP: ['ArrowUp'],
    NAV_DOWN: ['ArrowDown'],
    NAV_LEFT: ['ArrowLeft'],
    NAV_RIGHT: ['ArrowRight'],
    NAV_BACK: ['Tab'],
    TAB_PREV: ['z', 'Z'],
    TAB_NEXT: ['c', 'C'],
    SELECT: ['Enter', ' ', 'e', 'E'],
    COLLAPSE: ['ArrowLeft'],
    TOGGLE_TRACKING: ['t', 'T'],
    CLOSE_MAP: ['m', 'M']
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
}
