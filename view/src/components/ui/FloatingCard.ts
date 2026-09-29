import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager, Corner } from '@/systems/layoutManager.js';
import { SoundService } from '@/services/soundService.js';

import { ActionButtonGroup, ActionButtonConfig } from '@/components/ui/ButtonGroup.js';

export interface FloatingCardOptions {
    id: string;
    title: string;
    bodyHtml?: string;
    buttons?: ActionButtonConfig[];
    anchorMarker?: HTMLElement | null;
    coords?: { x: number, y: number };
    referencePanel?: HTMLElement | null;
    dockCorner?: Corner;
    onButtonSelectionChange?: (index: number) => void;
    returnFocusId?: string;
    onNavBack?: () => void;
}

export class FloatingCard {
    private static activeCards: Set<FloatingCard> = new Set();

    private options: FloatingCardOptions;
    private buttonGroup: ActionButtonGroup;
    private cardElement: HTMLElement | null = null;

    constructor(options: FloatingCardOptions) {
        this.options = options;
        this.buttonGroup = new ActionButtonGroup();
    }

    public static repositionAll(): void {
        FloatingCard.activeCards.forEach(card => {
            if (card.isOpen()) {
                card.updatePosition();
            }
        });
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
        card.classList.add('floating-card');
        this.cardElement = card;
        return card;
    }

    public update(options: Partial<FloatingCardOptions>): void {
        this.options = { ...this.options, ...options };
        this.render();
    }

    public open(anchorMarker?: HTMLElement | null, referencePanel?: HTMLElement | null, dockCorner?: Corner): void {
        if (!this.cardElement) {
            this.mount();
        }
        if (!this.cardElement) return;

        if (anchorMarker !== undefined) this.options.anchorMarker = anchorMarker;
        if (referencePanel !== undefined) this.options.referencePanel = referencePanel;
        if (dockCorner !== undefined) this.options.dockCorner = dockCorner;

        if (this.options.anchorMarker || this.options.coords) {
            this.cardElement.setAttribute('data-anchored', 'true');
        } else {
            this.cardElement.removeAttribute('data-anchored');
        }

        this.cardElement.style.display = 'flex';
        FloatingCard.activeCards.add(this);
        this.render();

        this.updatePosition();
    }

    public updatePosition(): void {
        if (!this.cardElement || this.cardElement.style.display === 'none') return;

        if (this.options.anchorMarker) {
            LayoutManager.anchorToElement(this.cardElement, this.options.anchorMarker, { gap: 20, padding: 10 });
        } else if (this.options.coords) {
            LayoutManager.anchorToCoords(this.cardElement, this.options.coords.x, this.options.coords.y, undefined, { gap: 20, padding: 10 });
        } else if (this.options.referencePanel && this.options.dockCorner) {
            LayoutManager.anchorToPanel(this.cardElement, this.options.referencePanel, this.options.dockCorner, 10);
        }
    }

    public close(): void {
        FloatingCard.activeCards.delete(this);
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

    public handleKeyDown(e: KeyboardEvent): boolean {
        const { dockCorner, returnFocusId, onNavBack } = this.options;

        const isRightDocked = dockCorner ? dockCorner.startsWith('top-right') || dockCorner.startsWith('bottom-right') : false;

        if ((isRightDocked && (KeybindsSystem.isAction(e, 'NAV_RIGHT') || e.key === 'ArrowRight')) ||
            (!isRightDocked && (KeybindsSystem.isAction(e, 'NAV_LEFT') || e.key === 'ArrowLeft'))) {
            if (returnFocusId) {
                FocusManager.setFocus(returnFocusId);
                SoundService.playFocus();
                return true;
            }
        }

        if (KeybindsSystem.isAction(e, 'NAV_BACK')) {
            if (returnFocusId && this.options.referencePanel) {
                FocusManager.setFocus(returnFocusId);
                SoundService.playFocus();
            } else {
                if (onNavBack) {
                    onNavBack();
                } else {
                    this.close();
                    if (returnFocusId) {
                        FocusManager.setFocus(returnFocusId);
                    } else {
                        FocusManager.setFocus('MAP');
                    }
                }
            }
            return true;
        }

        if (e.key === 'ArrowDown' || KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            this.buttonGroup.navigateNext();
            this.notifyButtonSelectionChange();
            return true;
        }

        if (e.key === 'ArrowUp' || KeybindsSystem.isAction(e, 'NAV_UP')) {
            this.buttonGroup.navigatePrev();
            this.notifyButtonSelectionChange();
            return true;
        }

        if (e.key === 'Enter' || e.key === ' ' || KeybindsSystem.isAction(e, 'SELECT')) {
            this.buttonGroup.triggerSelected();
            return true;
        }

        return false;
    }

    private notifyButtonSelectionChange(): void {
        if (this.options.onButtonSelectionChange) {
            this.options.onButtonSelectionChange(this.buttonGroup.getSelectedIndex());
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
            <div class="fc-header">
                <div class="fc-title">${this.escapeHtml(title)}</div>
            </div>
            ${hasBody ? `<div class="fc-body">${bodyHtml}</div>` : ''}
            ${(buttons && buttons.length > 0) ? `
            <div class="fc-bottom-bar-container">
                <div class="fc-bottom-bar"></div>
            </div>
            ` : ''}
        `;

        const bottomBar = this.cardElement.querySelector('.fc-bottom-bar') as HTMLElement;
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
