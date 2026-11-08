import { KeyAction, FocusOwner as SeamFocusOwner, InputReceiver, ActionDef, ControlActionDef, ControlActionHint } from '@/types/seams.js';

export type FocusOwner = SeamFocusOwner | string;
export const FocusOwner = {
    MAP: 'MAP',
    MARKER_CARD: 'MARKER_CARD',
    SETTLEMENT_CARD: 'SETTLEMENT_CARD',
    CUSTOM_MARKER_CARD: 'CUSTOM_MARKER_CARD',
    QUEST_CARD: 'QUEST_CARD',
    QUEST_LIST: 'QUEST_LIST',
    WORKSHOP_LIST: 'WORKSHOP_LIST',
    SEARCH_PANEL: 'SEARCH_PANEL',
    SETTINGS_MENU: 'SETTINGS_MENU',
    MODAL: 'MODAL',
} as const;

export {
    KeyAction,
    type InputReceiver,
    type ActionDef,
    type ControlActionDef,
    type ControlActionHint
};

export type FocusChangeListener = (newFocus: FocusOwner, oldFocus: FocusOwner) => void;
