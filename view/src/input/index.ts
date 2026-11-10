export { type FocusChangeListener } from './types.js';
export { FocusStack } from './focusStack.js';
export { InputRouter, InputRouterSystem, type CloseMapHandler } from './inputRouter.js';
export { CursorManager, cursorManager } from './cursor.js';
export {
    KeyAction,
    FocusOwner,
    type InputReceiver,
    type ActionDef,
    type ControlActionDef,
    type ControlActionHint
} from './types.js';

export {
    DEFAULT_KEYMAP,
    DEFAULT_LABELS,
    isAction,
    isPanelCollapseKey,
    isPanelExpandKey,
    getActionKeys,
    updateKeymap
} from './keymap.js';

export {
    gamepadBridge,
    ControllerStyle
} from './gamepadBridge.js';

export {
    getControllerGlyph,
    formatPrimaryKeyLabel,
    getPanelGlyph,
    getBadgeText,
    getControlText,
    getControlHtml,
    getActionGlyphHtml
} from './controlHints.js';

import {
    isAction as keymapIsAction,
    isPanelCollapseKey as keymapIsPanelCollapseKey,
    isPanelExpandKey as keymapIsPanelExpandKey,
    getActionKeys as keymapGetActionKeys,
    updateKeymap as keymapUpdateKeymap,
    DEFAULT_KEYMAP as compatKeymap
} from './keymap.js';

import { gamepadBridge as bridge } from './gamepadBridge.js';

import {
    getPanelGlyph as hintsGetPanelGlyph,
    getBadgeText as hintsGetBadgeText,
    getControlText as hintsGetControlText,
    getControlHtml as hintsGetControlHtml,
    getActionGlyphHtml as hintsGetActionGlyphHtml
} from './controlHints.js';

/**
 * Backward-compatibility facade for un-migrated components.
 */
export const KeybindsSystem = {
    get isControllerActive(): boolean {
        return bridge.isControllerActive;
    },
    set isControllerActive(val: boolean) {
        bridge.isControllerActive = val;
    },
    get controllerStyle(): number {
        return bridge.controllerStyle;
    },
    set controllerStyle(val: number) {
        bridge.controllerStyle = val;
    },
    initGamepadTracking: () => bridge.init(),
    handleKeyUp: (e: KeyboardEvent) => bridge.handleKeyUp(e),
    isAction: keymapIsAction,
    isPanelCollapseKey: keymapIsPanelCollapseKey,
    isPanelExpandKey: keymapIsPanelExpandKey,
    getActionKeys: keymapGetActionKeys,
    updateKeymap: keymapUpdateKeymap,
    getPanelGlyph: hintsGetPanelGlyph,
    getBadgeText: hintsGetBadgeText,
    getControlText: hintsGetControlText,
    getControlHtml: hintsGetControlHtml,
    getActionGlyphHtml: hintsGetActionGlyphHtml
};
