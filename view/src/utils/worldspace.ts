import { FORM_ID_INDEX_MASK } from '../core/constants.js';

export function isSameWorldspace(ws1: number, ws2: number): boolean {
    return (ws1 & FORM_ID_INDEX_MASK) === (ws2 & FORM_ID_INDEX_MASK);
}
