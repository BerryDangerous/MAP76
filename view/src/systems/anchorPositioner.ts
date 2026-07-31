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

        const pWidth = options.preferredWidth || panel.offsetWidth || 380;
        const pHeight = options.preferredHeight || panel.offsetHeight || 420;

        const markerCenterX = mRect.left + (mRect.width / 2);
        const markerCenterY = mRect.top + (mRect.height / 2);

        const placements = [
            { left: mRect.right + gap, top: markerCenterY - (pHeight / 2) },
            { left: mRect.left - pWidth - gap, top: markerCenterY - (pHeight / 2) },
            { left: markerCenterX - (pWidth / 2), top: mRect.top - pHeight - gap },
            { left: markerCenterX - (pWidth / 2), top: mRect.bottom + gap }
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

        panel.style.left = `${clampedLeft}px`;
        panel.style.top = `${clampedTop}px`;
    }
}
