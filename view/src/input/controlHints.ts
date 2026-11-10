import { KeyAction } from '@/types/seams.js';
import { t } from '@/core/i18n.js';
import { DEFAULT_LABELS, getActionKeys } from './keymap.js';
import { gamepadBridge, ControllerStyle } from './gamepadBridge.js';

const CONTROLLER_GLYPHS_XBOX: Record<string, string> = {
    Gamepad_A: 'A',
    Gamepad_B: 'B',
    Gamepad_X: 'C',
    Gamepad_Y: 'D',
    Gamepad_LB: 'G',
    Gamepad_RB: 'L',
    Gamepad_LBRB: 'Z',
    Gamepad_LT: 'I',
    Gamepad_RT: 'N',
    Gamepad_Start: 'O',
    Gamepad_Back: 'E',
    Gamepad_Up: 'w',
    Gamepad_Down: 'v',
    Gamepad_Left: 't',
    Gamepad_Right: 'u',
    Gamepad_LS: 'H',
    Gamepad_RS: 'M',
    Gamepad_LStick: 'F',
    Gamepad_RStick: 'K'
};

const CONTROLLER_GLYPHS_PS: Record<string, string> = {
    Gamepad_A: 'a',
    Gamepad_B: 'd',
    Gamepad_X: 'c',
    Gamepad_Y: 'b',
    Gamepad_LB: 'g',
    Gamepad_RB: 'm',
    Gamepad_LBRB: 'h',
    Gamepad_LT: 'j',
    Gamepad_RT: 'o',
    Gamepad_Start: 'p',
    Gamepad_Back: 'e',
    Gamepad_Up: 'w',
    Gamepad_Down: 'v',
    Gamepad_Left: 't',
    Gamepad_Right: 'u',
    Gamepad_LS: 'f',
    Gamepad_RS: 'l',
    Gamepad_LStick: 'i',
    Gamepad_RStick: 'n'
};

export function getControllerGlyph(gamepadKey: string, style: ControllerStyle | number): string | undefined {
    const glyphs = style === ControllerStyle.PLAYSTATION ? CONTROLLER_GLYPHS_PS : CONTROLLER_GLYPHS_XBOX;
    return glyphs[gamepadKey];
}

export function formatPrimaryKeyLabel(rawKey: string): string {
    if (rawKey === ' ') return t('controls.keys.space', { defaultValue: 'SPACE' });
    if (rawKey === 'Tab') return t('controls.keys.tab', { defaultValue: 'TAB' });
    if (rawKey === 'Enter') return t('controls.keys.enter', { defaultValue: 'ENTER' });
    if (rawKey === 'ArrowUp') return t('controls.keys.up', { defaultValue: 'UP' });
    if (rawKey === 'ArrowDown') return t('controls.keys.down', { defaultValue: 'DOWN' });
    if (rawKey === 'ArrowLeft') return t('controls.keys.left', { defaultValue: 'LEFT' });
    if (rawKey === 'ArrowRight') return t('controls.keys.right', { defaultValue: 'RIGHT' });
    if (rawKey === 'Shift') return t('controls.keys.shift', { defaultValue: 'SHIFT' });
    return rawKey.toUpperCase();
}

export function getPanelGlyph(rawGlyph: string): string {
    if (gamepadBridge.isControllerActive) {
        return rawGlyph.toLowerCase();
    }
    return rawGlyph;
}

export function getBadgeText(action: KeyAction): string {
    const keys = getActionKeys(action);
    if (!keys || keys.length === 0) return '';
    const primaryKey = keys.find((k) => !k.startsWith('Gamepad_')) || keys[0];
    if (primaryKey === ' ') return '[SPACE]';
    if (primaryKey === 'ArrowUp') return '[▲]';
    if (primaryKey === 'ArrowDown') return '[▼]';
    if (primaryKey === 'ArrowLeft') return '[◄]';
    if (primaryKey === 'ArrowRight') return '[►]';
    return `[${primaryKey.toUpperCase()}]`;
}

export function getControlText(action: KeyAction, overrideLabel?: string): string {
    const label = overrideLabel || t(DEFAULT_LABELS[action]) || action;
    if (action === 'PAN_MOUSE' && !gamepadBridge.isControllerActive) {
        return `Mouse) ${label}`;
    }

    const keys = getActionKeys(action);
    if (!keys || keys.length === 0) return `?) ${label}`;

    if (gamepadBridge.isControllerActive) {
        const gamepadKey = keys.find((k) => k.startsWith('Gamepad_'));
        if (gamepadKey) {
            const glyph = getControllerGlyph(gamepadKey, gamepadBridge.controllerStyle);
            if (glyph) {
                return `${glyph}) ${label}`;
            }
        }
    }

    const primaryKey = keys.find((k) => !k.startsWith('Gamepad_')) || keys[0];
    return `${formatPrimaryKeyLabel(primaryKey)}) ${label}`;
}

export function getControlHtml(action: KeyAction, overrideLabel?: string, isActive?: boolean): string {
    const label = overrideLabel || t(DEFAULT_LABELS[action]) || action;
    let labelHtml = `<b>${label}</b>`;
    if (isActive) {
        labelHtml = `<span style="text-decoration: underline;">${labelHtml}</span>`;
    }

    if (action === 'PAN_MOUSE' && !gamepadBridge.isControllerActive) {
        return `Mouse) ${labelHtml}`;
    }

    const glyphHtml = getActionGlyphHtml(action);
    return `${glyphHtml} ${labelHtml}`;
}

export function getActionGlyphHtml(action: KeyAction): string {
    const keys = getActionKeys(action);
    if (!keys || keys.length === 0) return `?)`;

    if (gamepadBridge.isControllerActive) {
        const gamepadKey = keys.find((k) => k.startsWith('Gamepad_'));
        if (gamepadKey) {
            const glyph = getControllerGlyph(gamepadKey, gamepadBridge.controllerStyle);
            if (glyph) {
                const isLowercase = glyph === glyph.toLowerCase();
                const fontFamily = isLowercase ? 'ControllerButtonsInverted' : 'ControllerButtons';
                return `<span class="controller-btn-icon" style="font-family: '${fontFamily}'; font-size: 1em; vertical-align: text-bottom; margin-right: 4px; display: inline-block; position: relative; top: 1px;">${glyph}</span>`;
            }
        }
    }

    const primaryKey = keys.find((k) => !k.startsWith('Gamepad_')) || keys[0];
    return `${formatPrimaryKeyLabel(primaryKey)})`;
}
