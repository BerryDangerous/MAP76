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
    NAV_BACK: ['Escape', 'Tab'],
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
        return allowedKeys.includes(e.key);
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
