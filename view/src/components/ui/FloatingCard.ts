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
    private isRendered = false;

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
        if (this.cardElement !== card) {
            this.isRendered = false;
        }
        this.cardElement = card;
        return card;
    }

    public update(options: Partial<FloatingCardOptions>): void {
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
        if (referencePanel !== undefined) this.options.referencePanel = referencePanel;
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

        if (this.options.anchorMarker) {
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
            LayoutManager.anchorToElement(this.cardElement, anchor, { gap: 20, padding: 10 });
        } else if (this.options.coords) {
            LayoutManager.anchorToCoords(this.cardElement, this.options.coords.x, this.options.coords.y, undefined, { gap: 20, padding: 10 });
        } else if (this.options.referencePanel && this.options.dockCorner) {
            LayoutManager.anchorToPanel(this.cardElement, this.options.referencePanel, this.options.dockCorner, 10);
        }
    }

    public close(): void {
        FloatingCard.activeCards.delete(this);
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

        const hasBody = Boolean(bodyHtml && bodyHtml.trim().length > 0);
        const hasButtons = Boolean(buttons && buttons.length > 0);

        if (!this.cardElement.querySelector('.fc-header')) {
            this.cardElement.innerHTML = `
                <div class="fc-header">
                    <div class="fc-title"></div>
                </div>
                <div class="fc-body"></div>
                <div class="fc-bottom-bar-container" style="display: none;">
                    <div class="fc-bottom-bar"></div>
                </div>
            `;
        }

        const titleEl = this.cardElement.querySelector('.fc-title') as HTMLElement | null;
        const bodyEl = this.cardElement.querySelector('.fc-body') as HTMLElement | null;
        const bottomBarContainer = this.cardElement.querySelector('.fc-bottom-bar-container') as HTMLElement | null;
        const bottomBar = this.cardElement.querySelector('.fc-bottom-bar') as HTMLElement | null;

        if (titleEl) {
            titleEl.textContent = title;
        }

        if (bodyEl) {
            if (hasBody) {
                bodyEl.innerHTML = bodyHtml || '';
                bodyEl.style.display = 'flex';
            } else {
                bodyEl.innerHTML = '';
                bodyEl.style.display = 'none';
            }
        }

        if (bottomBarContainer && bottomBar) {
            if (hasButtons && buttons) {
                bottomBarContainer.style.display = 'flex';
                if (bottomBar.children.length === 0) {
                    this.buttonGroup.mount(bottomBar, (idx) => {
                        if (this.options.onButtonSelectionChange) {
                            this.options.onButtonSelectionChange(idx);
                        }
                    });
                }
                this.buttonGroup.setButtons(buttons);
            } else {
                bottomBarContainer.style.display = 'none';
                bottomBar.innerHTML = '';
            }
        }

        this.isRendered = true;
    }
}
