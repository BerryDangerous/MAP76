import { appSettings } from '../core/settings.js';

export interface AnchorPositionOptions {
    gap?: number;
    padding?: number;
    preferredWidth?: number;
    preferredHeight?: number;
}

export class AnchorPositioner {
    public static positionNearElement(
        panel: HTMLElement,
        targetMarker: HTMLElement,
        options: AnchorPositionOptions = {}
    ): void {
        if (!panel || !targetMarker) return;

        const gap = options.gap ?? 20;
        const padding = options.padding ?? 10;

        const imgEl = targetMarker.querySelector('img');
        const mRect = imgEl ? imgEl.getBoundingClientRect() : targetMarker.getBoundingClientRect();

        const markerCenterX = mRect.left + (mRect.width / 2);
        const markerCenterY = mRect.top + (mRect.height / 2);

        this.positionNearCoords(panel, markerCenterX, markerCenterY, mRect, options);
    }

    public static positionNearCoords(
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
