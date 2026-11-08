import { ScreenAnchor } from '@/types/seams.js';
import { appSettings } from '@/core/settings.js';

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface CornerConfig {
    corner: Corner;
    collapseKey: string;
    expandKey: string;
    collapseGlyph: string;
    expandGlyph: string;
}

export interface CornerMargins {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
}

export interface AnchorPositionOptions {
    gap?: number;
    padding?: number;
    preferredWidth?: number;
    preferredHeight?: number;
}

const CORNER_CONFIGS: Record<Corner, CornerConfig> = {
    'top-left': {
        corner: 'top-left',
        collapseKey: 'ArrowLeft',
        expandKey: 'ArrowRight',
        collapseGlyph: 'T',
        expandGlyph: 'U'
    },
    'top-right': {
        corner: 'top-right',
        collapseKey: 'ArrowRight',
        expandKey: 'ArrowDown',
        collapseGlyph: 'U',
        expandGlyph: 'V'
    },
    'bottom-left': {
        corner: 'bottom-left',
        collapseKey: 'ArrowLeft',
        expandKey: 'ArrowUp',
        collapseGlyph: 'T',
        expandGlyph: 'W'
    },
    'bottom-right': {
        corner: 'bottom-right',
        collapseKey: 'ArrowRight',
        expandKey: 'ArrowLeft',
        collapseGlyph: 'U',
        expandGlyph: 'T'
    }
};

export function getCornerConfig(corner: Corner): CornerConfig {
    return CORNER_CONFIGS[corner];
}

export function anchorToCorner(
    element: HTMLElement,
    corner: Corner,
    margins: CornerMargins = {}
): void {
    element.setAttribute('data-dock', corner);

    element.style.top = '';
    element.style.bottom = '';
    element.style.left = '';
    element.style.right = '';

    const formatOffset = (v: number | string) => typeof v === 'number' ? `${v}px` : String(v);

    const defaultHorizontalOffset = 10;
    const defaultVerticalOffset = 50;

    if (corner.includes('top')) {
        element.style.top = formatOffset(margins.top ?? defaultVerticalOffset);
    } else if (corner.includes('bottom')) {
        element.style.bottom = formatOffset(margins.bottom ?? defaultVerticalOffset);
    }

    if (corner.includes('left')) {
        element.style.left = formatOffset(margins.left ?? defaultHorizontalOffset);
    } else if (corner.includes('right')) {
        element.style.right = formatOffset(margins.right ?? defaultHorizontalOffset);
    }
}

export function anchorCardToPanel(
    card: HTMLElement,
    referencePanel: HTMLElement,
    corner: Corner,
    gap: number = 10
): void {
    if (!card || !referencePanel) return;

    const refRect = referencePanel.getBoundingClientRect();
    card.setAttribute('data-dock', corner);

    card.style.top = '';
    card.style.bottom = '';
    card.style.left = '';
    card.style.right = '';

    const isUltralight = navigator.userAgent.includes('Ultralight');
    const divisor = isUltralight ? 1.0 : appSettings.uiScale;

    if (corner === 'top-left' || corner === 'bottom-left') {
        card.style.top = `${refRect.top / divisor}px`;
        card.style.left = `${(refRect.right + gap) / divisor}px`;
        card.style.transformOrigin = 'top left';
    } else if (corner === 'top-right' || corner === 'bottom-right') {
        const viewportWidth = isUltralight ? (window.innerWidth / appSettings.uiScale) : window.innerWidth;
        card.style.top = `${refRect.top / divisor}px`;
        card.style.right = `${(viewportWidth - refRect.left + gap) / divisor}px`;
        card.style.transformOrigin = 'top right';
    }
}

export function anchorCardToScreen(
    card: HTMLElement,
    anchor: ScreenAnchor,
    options: AnchorPositionOptions = {}
): void {
    const rect = {
        left: anchor.x,
        top: anchor.y,
        right: anchor.x + anchor.width,
        bottom: anchor.y + anchor.height,
        width: anchor.width,
        height: anchor.height
    };

    const centerX = anchor.x + (anchor.width / 2);
    const centerY = anchor.y + (anchor.height / 2);

    anchorCardToCoordinates(card, centerX, centerY, rect, options);
}

export function anchorCardToCoordinates(
    card: HTMLElement,
    x: number,
    y: number,
    rect: { left: number; right: number; top: number; bottom: number; width: number; height: number } = { left: x, right: x, top: y, bottom: y, width: 0, height: 0 },
    options: AnchorPositionOptions = {}
): void {
    if (!card) return;

    const gap = options.gap ?? 20;
    const padding = options.padding ?? 10;

    const scale = appSettings.uiScale;
    const pWidth = (options.preferredWidth || card.offsetWidth || 380) * scale;
    const pHeight = (options.preferredHeight || card.offsetHeight || 420) * scale;

    const placements = [
        { left: rect.right + gap, top: y - (pHeight / 2) },
        { left: rect.left - pWidth - gap, top: y - (pHeight / 2) },
        { left: x - (pWidth / 2), top: rect.top - pHeight - gap },
        { left: x - (pWidth / 2), top: rect.bottom + gap }
    ];

    let chosen = placements[0];

    for (const pos of placements) {
        if (
            pos.left >= 0 &&
            pos.top >= 0 &&
            pos.left + pWidth <= window.innerWidth &&
            pos.top + pHeight <= window.innerHeight
        ) {
            chosen = pos;
            break;
        }
    }

    const clampedLeft = Math.max(padding, Math.min(window.innerWidth - pWidth - padding, chosen.left));
    const clampedTop = Math.max(padding, Math.min(window.innerHeight - pHeight - padding, chosen.top));

    card.style.left = `${clampedLeft / scale}px`;
    card.style.top = `${clampedTop / scale}px`;
}
