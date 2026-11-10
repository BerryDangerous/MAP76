import { ActionButtonGroup, ActionButtonConfig } from './ButtonGroup.js';

export interface CardConfig {
    id?: string;
    title?: string;
    bodyHtml?: string;
    buttons?: ActionButtonConfig[];
    onButtonSelectionChange?: (index: number) => void;
    onClose?: () => void;
}

/**
 * Pure, stateless presentation container for floating detail cards.
 * Encapsulates the visual DOM structure, header, body, and action button group
 * with inverted mounting control (exposing `this.element` without auto-appending to DOM).
 */
export class Card {
    public readonly element: HTMLElement;
    private titleEl: HTMLElement;
    private bodyEl: HTMLElement;
    private bottomBarContainer: HTMLElement;
    private bottomBar: HTMLElement;
    private buttonGroup: ActionButtonGroup;
    private config: CardConfig;

    constructor(config: CardConfig = {}) {
        this.config = { ...config };
        this.buttonGroup = new ActionButtonGroup();

        this.element = document.createElement('div');
        this.element.className = 'floating-card';
        this.element.style.display = 'none';
        if (this.config.id) {
            this.element.id = this.config.id;
        }

        this.element.innerHTML = `
            <div class="fc-header">
                <div class="fc-title"></div>
            </div>
            <div class="fc-body" style="display: none;"></div>
            <div class="fc-bottom-bar-container" style="display: none;">
                <div class="fc-bottom-bar"></div>
            </div>
        `;

        this.titleEl = this.element.querySelector('.fc-title') as HTMLElement;
        this.bodyEl = this.element.querySelector('.fc-body') as HTMLElement;
        this.bottomBarContainer = this.element.querySelector('.fc-bottom-bar-container') as HTMLElement;
        this.bottomBar = this.element.querySelector('.fc-bottom-bar') as HTMLElement;

        this.buttonGroup.mount(this.bottomBar, (idx) => {
            if (this.config.onButtonSelectionChange) {
                this.config.onButtonSelectionChange(idx);
            }
        });

        this.update(config);
    }

    public getButtonGroup(): ActionButtonGroup {
        return this.buttonGroup;
    }

    public setTitle(title: string): void {
        this.config.title = title;
        this.titleEl.textContent = title;
    }

    public setBodyHtml(html?: string): void {
        this.config.bodyHtml = html;
        const hasBody = Boolean(html && html.trim().length > 0);
        if (hasBody) {
            this.bodyEl.innerHTML = html || '';
            this.bodyEl.style.display = 'flex';
        } else {
            this.bodyEl.innerHTML = '';
            this.bodyEl.style.display = 'none';
        }
    }

    public setButtons(buttons?: ActionButtonConfig[]): void {
        this.config.buttons = buttons;
        const hasButtons = Boolean(buttons && buttons.length > 0);
        if (hasButtons && buttons) {
            this.bottomBarContainer.style.display = 'flex';
            this.buttonGroup.setButtons(buttons);
        } else {
            this.bottomBarContainer.style.display = 'none';
            this.buttonGroup.setButtons([]);
        }
    }

    public update(config: Partial<CardConfig>): void {
        this.config = { ...this.config, ...config };
        if (config.id !== undefined) {
            this.element.id = config.id;
        }
        if (config.title !== undefined) {
            this.setTitle(config.title);
        }
        if ('bodyHtml' in config) {
            this.setBodyHtml(config.bodyHtml);
        }
        if (config.buttons !== undefined) {
            this.setButtons(config.buttons);
        }
    }

    public navigateNext(): void {
        this.buttonGroup.navigateNext();
    }

    public navigatePrev(): void {
        this.buttonGroup.navigatePrev();
    }

    public triggerSelected(): void {
        this.buttonGroup.triggerSelected();
    }

    public setAnchored(anchored: boolean): void {
        if (anchored) {
            this.element.setAttribute('data-anchored', 'true');
        } else {
            this.element.removeAttribute('data-anchored');
        }
    }

    public setFocused(focused: boolean): void {
        this.element.classList.toggle('focused', focused);
    }

    public show(): void {
        this.element.style.display = 'flex';
    }

    public hide(): void {
        this.element.style.display = 'none';
        this.setAnchored(false);
        this.setFocused(false);
    }

    public isOpen(): boolean {
        return this.element.style.display !== 'none' && Boolean(this.element.parentElement);
    }

    public mount(parent: HTMLElement = document.body): HTMLElement {
        if (!this.element.parentElement || this.element.parentElement !== parent) {
            parent.appendChild(this.element);
        }
        return this.element;
    }

    public destroy(): void {
        this.buttonGroup.destroy();
        if (this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
    }
}
