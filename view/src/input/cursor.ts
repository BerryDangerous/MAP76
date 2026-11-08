import { InputRouter } from './inputRouter.js';

export class CursorManager {
    private cursor: HTMLImageElement | null = null;
    private cursorFramePending = false;
    private lastClientX = 0;
    private lastClientY = 0;
    private lastTarget: HTMLElement | null = null;
    private unsubscribeFocus: (() => void) | null = null;

    private static readonly MAP_ELEMENT_IDS = new Set([
        'map-bg',
        'map-bg-container',
        'map-viewport',
        'marker-layer',
        'supply-lines-layer'
    ]);

    public init(): void {
        if (typeof document === 'undefined') return;

        let el = document.getElementById('custom-cursor') as HTMLImageElement | null;
        if (!el) {
            el = document.createElement('img');
            el.id = 'custom-cursor';
            el.src = 'assets/cursor.svg';
            document.body.appendChild(el);
        }
        this.cursor = el;

        window.addEventListener('mousemove', (e: MouseEvent) => {
            this.lastClientX = e.clientX;
            this.lastClientY = e.clientY;
            this.lastTarget = e.target as HTMLElement;

            if (!this.cursorFramePending) {
                this.cursorFramePending = true;
                requestAnimationFrame(() => {
                    this.cursorFramePending = false;
                    this.renderPosition();
                    if (this.lastTarget) {
                        this.updateCursorVisual(this.lastTarget);
                    }
                });
            }
        });

        document.addEventListener('mouseleave', () => {
            if (this.cursor) {
                this.cursor.style.display = 'none';
            }
        });

        this.unsubscribeFocus = InputRouter.subscribe(() => {
            this.refreshCursorState();
        });
    }

    public refreshCursorState(): void {
        if (!this.cursor || typeof document === 'undefined') return;

        const target = document.elementFromPoint(this.lastClientX, this.lastClientY) as HTMLElement | null;
        if (target) {
            this.lastTarget = target;
            this.updateCursorVisual(target);
        }
    }

    public destroy(): void {
        if (this.unsubscribeFocus) {
            this.unsubscribeFocus();
            this.unsubscribeFocus = null;
        }
        if (this.cursor) {
            this.cursor.remove();
            this.cursor = null;
        }
    }

    private renderPosition(): void {
        if (!this.cursor) return;
        this.cursor.style.left = `${this.lastClientX}px`;
        this.cursor.style.top = `${this.lastClientY}px`;
        if (this.cursor.style.display !== 'block') {
            this.cursor.style.display = 'block';
        }
    }

    private updateCursorVisual(target: HTMLElement): void {
        if (!this.cursor) return;

        const isMapHover =
            CursorManager.MAP_ELEMENT_IDS.has(target.id) ||
            target.closest('.marker-container') !== null ||
            target.closest('#map-bg-container') !== null;

        const desiredCursor = isMapHover ? 'assets/cursor2.svg' : 'assets/cursor.svg';

        if (this.cursor.getAttribute('src') !== desiredCursor) {
            this.cursor.setAttribute('src', desiredCursor);
            this.cursor.classList.toggle('map', isMapHover);
        }
    }
}

export const cursorManager = new CursorManager();
