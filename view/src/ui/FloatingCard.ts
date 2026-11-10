import { ScreenAnchor } from '@/types/seams.js';
import {
    Corner,
    anchorCardToPanel,
    anchorCardToScreen,
    anchorCardToCoordinates
} from '@/overlays/positioning.js';

import { Card } from './Card.js';
import { ActionButtonGroup, ActionButtonConfig } from './ButtonGroup.js';

export interface FloatingCardOptions {
    id: string;
    title: string;
    bodyHtml?: string;
    buttons?: ActionButtonConfig[];
    screenAnchor?: ScreenAnchor;
    anchorMarker?: HTMLElement | null;
    coords?: { x: number, y: number };
    referencePanel?: HTMLElement | null;
    dockCorner?: Corner;
    onButtonSelectionChange?: (index: number) => void;
}

export class FloatingCard {
    private static activeCards: Set<FloatingCard> = new Set();

    private options: FloatingCardOptions;
    private card: Card;
    private cardElement: HTMLElement | null = null;
    private isRendered = false;

    constructor(options: FloatingCardOptions) {
        this.options = options;
        this.card = new Card({
            id: options.id,
            title: options.title,
            bodyHtml: options.bodyHtml,
            buttons: options.buttons,
            onButtonSelectionChange: options.onButtonSelectionChange,
        });
    }

    public static repositionAll(): void {
        FloatingCard.activeCards.forEach(card => {
            if (card.isOpen()) {
                card.updatePosition();
            }
        });
    }

    public getButtonGroup(): ActionButtonGroup {
        return this.card.getButtonGroup();
    }

    public getElement(): HTMLElement | null {
        return this.cardElement;
    }

    public mount(parent: HTMLElement = document.body): HTMLElement {
        this.card.mount(parent);
        this.cardElement = this.card.element;
        this.isRendered = true;
        return this.cardElement;
    }

    public update(options: Partial<FloatingCardOptions>): void {
        if (options.referencePanel !== undefined && options.referencePanel !== this.options.referencePanel) {
            this.setReferencePanelDimmed(false);
        }
        this.options = { ...this.options, ...options };
        if (!this.cardElement) {
            this.mount();
        }
        this.render();
    }

    public open(anchorMarker?: HTMLElement | null, referencePanel?: HTMLElement | null, dockCorner?: Corner): void {
        if (!this.cardElement) {
            this.mount();
        }
        if (!this.cardElement) return;

        if (anchorMarker !== undefined) this.options.anchorMarker = anchorMarker;
        if (referencePanel !== undefined) {
            if (referencePanel !== this.options.referencePanel) {
                this.setReferencePanelDimmed(false);
            }
            this.options.referencePanel = referencePanel;
        }
        if (dockCorner !== undefined) this.options.dockCorner = dockCorner;

        if (this.options.anchorMarker || this.options.coords) {
            this.cardElement.setAttribute('data-anchored', 'true');
        } else {
            this.cardElement.removeAttribute('data-anchored');
        }

        this.cardElement.style.display = 'flex';
        FloatingCard.activeCards.add(this);

        if (!this.isRendered) {
            this.render();
        }

        this.updatePosition();
    }

    public updatePosition(): void {
        if (!this.cardElement || this.cardElement.style.display === 'none') return;

        if (this.options.screenAnchor) {
            anchorCardToScreen(this.cardElement, this.options.screenAnchor, { gap: 20, padding: 10 });
        } else if (this.options.referencePanel && this.options.dockCorner) {
            anchorCardToPanel(this.cardElement, this.options.referencePanel, this.options.dockCorner, 10);
        } else if (this.options.coords) {
            anchorCardToCoordinates(this.cardElement, this.options.coords.x, this.options.coords.y, undefined, { gap: 20, padding: 10 });
        } else if (this.options.anchorMarker) {
            let anchor = this.options.anchorMarker;
            if (!anchor.isConnected) {
                const formId = anchor.dataset.formId;
                const isCustom = anchor.classList.contains('custom-marker') || anchor.dataset.markerType === 'customMarker';
                let reconnected: HTMLElement | null = null;

                if (formId) {
                    reconnected = (document.querySelector(`.marker-container[data-form-id="${formId}"]`) ||
                                   document.querySelector(`.quest-marker[data-form-id="${formId}"]`) ||
                                   document.querySelector(`[data-form-id="${formId}"]`)) as HTMLElement | null;
                } else if (isCustom) {
                    reconnected = document.querySelector('.custom-marker') as HTMLElement | null;
                }

                if (reconnected) {
                    this.options.anchorMarker = reconnected;
                    reconnected.classList.add('menu-active', 'hide-tooltip-override');
                    anchor = reconnected;
                } else {
                    return;
                }
            }
            const svgEl = anchor.querySelector('svg');
            const mRect = svgEl ? svgEl.getBoundingClientRect() : anchor.getBoundingClientRect();
            anchorCardToCoordinates(this.cardElement, mRect.left + (mRect.width / 2), mRect.top + (mRect.height / 2), mRect, { gap: 20, padding: 10 });
        }
    }

    public close(): void {
        FloatingCard.activeCards.delete(this);
        this.setReferencePanelDimmed(false);
        if (this.options.anchorMarker) {
            if (this.options.anchorMarker.isConnected) {
                this.options.anchorMarker.classList.remove('menu-active');
                this.options.anchorMarker.classList.remove('hide-tooltip-override');
            } else if (this.options.anchorMarker.dataset.formId) {
                const formId = this.options.anchorMarker.dataset.formId;
                const reconnected = document.querySelector(`[data-form-id="${formId}"]`);
                if (reconnected) {
                    reconnected.classList.remove('menu-active');
                    reconnected.classList.remove('hide-tooltip-override');
                }
            }
        }
        if (this.cardElement) {
            this.cardElement.style.display = 'none';
            this.cardElement.removeAttribute('data-anchored');
        }
    }

    public setReferencePanelDimmed(dimmed: boolean): void {
        if (this.options.referencePanel) {
            if (dimmed) {
                this.options.referencePanel.classList.add('dimmed');
            } else {
                this.options.referencePanel.classList.remove('dimmed');
            }
        }
    }

    public isOpen(): boolean {
        return !!this.cardElement && this.cardElement.style.display !== 'none';
    }

    public render(): void {
        if (!this.cardElement) return;

        this.card.update({
            title: this.options.title,
            bodyHtml: this.options.bodyHtml,
            buttons: this.options.buttons,
            onButtonSelectionChange: this.options.onButtonSelectionChange,
        });

        this.isRendered = true;
    }
}
