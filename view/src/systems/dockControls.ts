import { appSettings } from '../core/settings.js';

export type DockCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface DockConfig {
    corner: DockCorner;
    collapseKey: string;
    expandKey: string;
    collapseGlyph: string;
    expandGlyph: string;
}

export interface DockMargins {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
}

export class DockControlsSystem {
    private static dockConfigs: Record<DockCorner, DockConfig> = {
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

    public static getDockConfig(corner: DockCorner): DockConfig {
        return this.dockConfigs[corner];
    }

    public static isCollapseKey(e: KeyboardEvent, corner: DockCorner): boolean {
        const config = this.getDockConfig(corner);
        return e.key === config.collapseKey;
    }

    public static isExpandKey(e: KeyboardEvent, corner: DockCorner): boolean {
        const config = this.getDockConfig(corner);
        return e.key === config.expandKey;
    }

    public static getGlyph(corner: DockCorner, isCollapsed: boolean): string {
        const config = this.getDockConfig(corner);
        return isCollapsed ? config.expandGlyph : config.collapseGlyph;
    }

    public static applyDockPosition(
        element: HTMLElement,
        corner: DockCorner,
        margins: DockMargins = {}
    ): void {
        element.setAttribute('data-dock', corner);

        element.style.top = '';
        element.style.bottom = '';
        element.style.left = '';
        element.style.right = '';

        const fmt = (v: number | string) => typeof v === 'number' ? `${v}px` : String(v);

        const defaultOffset = 10;

        if (corner.includes('top')) {
            element.style.top = fmt(margins.top ?? defaultOffset);
        } else if (corner.includes('bottom')) {
            element.style.bottom = fmt(margins.bottom ?? defaultOffset);
        }

        if (corner.includes('left')) {
            element.style.left = fmt(margins.left ?? defaultOffset);
        } else if (corner.includes('right')) {
            element.style.right = fmt(margins.right ?? defaultOffset);
        }
    }

    public static dockNextToPanel(
        card: HTMLElement,
        referencePanel: HTMLElement,
        corner: DockCorner,
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
}
