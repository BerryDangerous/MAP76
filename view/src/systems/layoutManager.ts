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

export class LayoutManager {
    private static cornerConfigs: Record<Corner, CornerConfig> = {
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

    public static getCornerConfig(corner: Corner): CornerConfig {
        return this.cornerConfigs[corner];
    }

    public static anchorToCorner(
        element: HTMLElement,
        corner: Corner,
        margins: CornerMargins = {}
    ): void {
        element.setAttribute('data-dock', corner);

        element.style.top = '';
        element.style.bottom = '';
        element.style.left = '';
        element.style.right = '';

        const fmt = (v: number | string) => typeof v === 'number' ? `${v}px` : String(v);

        const defaultHorizontalOffset = 10;
        const defaultVerticalOffset = 50;

        if (corner.includes('top')) {
            element.style.top = fmt(margins.top ?? defaultVerticalOffset);
        } else if (corner.includes('bottom')) {
            element.style.bottom = fmt(margins.bottom ?? defaultVerticalOffset);
        }

        if (corner.includes('left')) {
            element.style.left = fmt(margins.left ?? defaultHorizontalOffset);
        } else if (corner.includes('right')) {
            element.style.right = fmt(margins.right ?? defaultHorizontalOffset);
        }
    }

    public static anchorToPanel(
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

    public static anchorToElement(
        panel: HTMLElement,
        targetMarker: HTMLElement,
        options: AnchorPositionOptions = {}
    ): void {
        if (!panel || !targetMarker) return;

        const svgEl = targetMarker.querySelector('svg');
        const mRect = svgEl ? svgEl.getBoundingClientRect() : targetMarker.getBoundingClientRect();

        const markerCenterX = mRect.left + (mRect.width / 2);
        const markerCenterY = mRect.top + (mRect.height / 2);

        this.anchorToCoords(panel, markerCenterX, markerCenterY, mRect, options);
    }

    public static anchorToCoords(
        panel: HTMLElement,
        x: number,
        y: number,
        rect: DOMRect | { left: number, right: number, top: number, bottom: number, width: number, height: number } = { left: x, right: x, top: y, bottom: y, width: 0, height: 0 },
        options: AnchorPositionOptions = {}
    ): void {
        if (!panel) return;

        const gap = options.gap ?? 20;
        const padding = options.padding ?? 10;

        const scale = appSettings.uiScale;
        const pWidth = (options.preferredWidth || panel.offsetWidth || 380) * scale;
        const pHeight = (options.preferredHeight || panel.offsetHeight || 420) * scale;

        const markerCenterX = x;
        const markerCenterY = y;

        const placements = [
            { left: rect.right + gap, top: markerCenterY - (pHeight / 2) },
            { left: rect.left - pWidth - gap, top: markerCenterY - (pHeight / 2) },
            { left: markerCenterX - (pWidth / 2), top: rect.top - pHeight - gap },
            { left: markerCenterX - (pWidth / 2), top: rect.bottom + gap }
        ];

        let chosenCoordinates = placements[0];

        for (const pos of placements) {
            if (
                pos.left >= 0 &&
                pos.top >= 0 &&
                pos.left + pWidth <= window.innerWidth &&
                pos.top + pHeight <= window.innerHeight
            ) {
                chosenCoordinates = pos;
                break;
            }
        }

        let clampedLeft = Math.max(padding, Math.min(window.innerWidth - pWidth - padding, chosenCoordinates.left));
        let clampedTop = Math.max(padding, Math.min(window.innerHeight - pHeight - padding, chosenCoordinates.top));

        const divisor = scale;
        panel.style.left = `${clampedLeft / divisor}px`;
        panel.style.top = `${clampedTop / divisor}px`;
    }
}
