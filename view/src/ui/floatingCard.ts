import { ActionButtonGroup, ActionButtonConfig } from './actionButton.js';
import { AnchorPositioner } from '../systems/anchorPositioner.js';
import { DockControlsSystem, DockCorner } from '../systems/dockControls.js';

export interface FloatingCardOptions {
    id: string;
    title: string;
    bodyHtml?: string;
    buttons?: ActionButtonConfig[];
    anchorMarker?: HTMLElement | null;
    referencePanel?: HTMLElement | null;
    dockCorner?: DockCorner;
    onButtonSelectionChange?: (index: number) => void;
}

export class FloatingCard {
    private options: FloatingCardOptions;
    private buttonGroup: ActionButtonGroup;
    private cardElement: HTMLElement | null = null;

    constructor(options: FloatingCardOptions) {
        this.options = options;
        this.buttonGroup = new ActionButtonGroup();
    }

    public getButtonGroup(): ActionButtonGroup {
        return this.buttonGroup;
    }

    public getElement(): HTMLElement | null {
        return this.cardElement;
    }

    public mount(parent: HTMLElement = document.body): HTMLElement {
        let card = document.getElementById(this.options.id);
        if (!card) {
            card = document.createElement('div');
            card.id = this.options.id;
            parent.appendChild(card);
        }
        this.cardElement = card;
        return card;
    }

    public update(options: Partial<FloatingCardOptions>): void {
        this.options = { ...this.options, ...options };
        this.render();
    }

    public open(anchorMarker?: HTMLElement | null, referencePanel?: HTMLElement | null, dockCorner?: DockCorner): void {
        if (!this.cardElement) {
            this.mount();
        }
        if (!this.cardElement) return;

        if (anchorMarker !== undefined) this.options.anchorMarker = anchorMarker;
        if (referencePanel !== undefined) this.options.referencePanel = referencePanel;
        if (dockCorner !== undefined) this.options.dockCorner = dockCorner;

        if (this.options.anchorMarker) {
            this.cardElement.setAttribute('data-anchored', 'true');
        } else {
            this.cardElement.removeAttribute('data-anchored');
        }

        this.cardElement.style.display = 'flex';
        this.render();

        this.updatePosition();
    }

    public updatePosition(): void {
        if (!this.cardElement || this.cardElement.style.display === 'none') return;

        if (this.options.anchorMarker) {
            AnchorPositioner.positionNearElement(this.cardElement, this.options.anchorMarker, { gap: 20, padding: 10 });
        } else if (this.options.referencePanel && this.options.dockCorner) {
            DockControlsSystem.dockNextToPanel(this.cardElement, this.options.referencePanel, this.options.dockCorner, 10);
        }
    }

    public close(): void {
        if (this.cardElement) {
            this.cardElement.style.display = 'none';
            this.cardElement.removeAttribute('data-anchored');
        }
    }

    public isOpen(): boolean {
        return !!this.cardElement && this.cardElement.style.display !== 'none';
    }

    public render(): void {
        if (!this.cardElement) return;

        const { title, bodyHtml, buttons } = this.options;

        if (buttons && buttons.length > 0) {
            this.buttonGroup.setButtons(buttons);
        }

        const hasBody = Boolean(bodyHtml && bodyHtml.trim().length > 0);

        this.cardElement.innerHTML = `
            <div class="qc-header">
                <div class="qc-title">${this.escapeHtml(title)}</div>
            </div>
            ${hasBody ? `<div class="qc-body">${bodyHtml}</div>` : ''}
            <div class="qc-bottom-bar-container">
                <div class="qc-bottom-bar"></div>
            </div>
        `;

        const bottomBar = this.cardElement.querySelector('.qc-bottom-bar') as HTMLElement;
        if (bottomBar && buttons && buttons.length > 0) {
            this.buttonGroup.mount(bottomBar, (idx) => {
                if (this.options.onButtonSelectionChange) {
                    this.options.onButtonSelectionChange(idx);
                }
            });
        }
    }

    private escapeHtml(str: string): string {
        return str.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }
}
