import { FocusManager } from '@/input/index.js';

interface ActiveCard {
    id: string;
    element: HTMLElement | null;
    referencePanel: HTMLElement | null;
    onDismiss: () => void;
    returnFocusId?: string;
}

interface RegisteredPanel {
    id: string;
    element: HTMLElement;
    collapse: () => void;
}

class OverlayManagerSystem {
    private activeCard: ActiveCard | null = null;
    private expandedPanels: Map<string, RegisteredPanel> = new Map();
    private dockedCardRafId: number | null = null;
    private pendingCardAction: (() => void) | null = null;

    init() {
        window.addEventListener('click', (e: MouseEvent) => {
            const targetNode = e.target as Node;
            
            const clickedInsideCard = this.activeCard?.element?.contains(targetNode) ?? false;
            
            let clickedInsidePanel = false;
            for (const panel of this.expandedPanels.values()) {
                if (panel.element.contains(targetNode)) {
                    clickedInsidePanel = true;
                    break;
                }
            }

            if (!clickedInsideCard && !clickedInsidePanel) {
                this.dismissAll();
            }
        });
    }

    registerPanel(id: string, element: HTMLElement, collapse: () => void) {
        this.expandedPanels.set(id, { id, element, collapse });
    }

    /**
     * Schedules opening a docked card via animation frame.
     * Coalesces rapid updates during list navigation so at most
     * one update runs per frame, preventing input lag.
     */
    scheduleDockedCard(openAction: () => void): void {
        this.pendingCardAction = openAction;
        if (this.dockedCardRafId !== null) return;

        this.dockedCardRafId = requestAnimationFrame(() => {
            this.dockedCardRafId = null;
            const action = this.pendingCardAction;
            this.pendingCardAction = null;
            if (action) {
                action();
            }
        });
    }

    /**
     * Executes any pending scheduled card immediately.
     */
    flushScheduledCard(): void {
        if (this.dockedCardRafId !== null) {
            cancelAnimationFrame(this.dockedCardRafId);
            this.dockedCardRafId = null;
        }
        if (this.pendingCardAction) {
            const action = this.pendingCardAction;
            this.pendingCardAction = null;
            action();
        }
    }

    /**
     * Cancels any pending scheduled card without opening it.
     */
    cancelScheduledCard(): void {
        if (this.dockedCardRafId !== null) {
            cancelAnimationFrame(this.dockedCardRafId);
            this.dockedCardRafId = null;
        }
        this.pendingCardAction = null;
    }

    openCard(id: string, options: { 
        cardElement: HTMLElement | null, 
        referencePanel?: HTMLElement | null, 
        onDismiss: () => void,
        takeFocus?: boolean,
        returnFocusId?: string
    }) {
        this.cancelScheduledCard();
        const previousCard = this.activeCard;
        this.activeCard = null;

        if (previousCard && previousCard.id !== id) {
            previousCard.onDismiss();
        }

        for (const panel of this.expandedPanels.values()) {
            if (options.referencePanel !== panel.element && (!panel.element.hasAttribute('data-collapsed') || panel.element.getAttribute('data-collapsed') === 'false')) {
                panel.collapse();
            }
        }

        this.activeCard = {
            id,
            element: options.cardElement,
            referencePanel: options.referencePanel || null,
            onDismiss: options.onDismiss,
            returnFocusId: options.returnFocusId
        };

        if (options.takeFocus !== false) {
            FocusManager.setFocus(id);
        }
    }

    notifyCardClosed(id: string) {
        if (this.activeCard && this.activeCard.id === id) {
            const returnFocusId = this.activeCard.returnFocusId;
            const wasFocused = FocusManager.getFocus() === id;
            this.activeCard = null;
            if (wasFocused) {
                FocusManager.setFocus(returnFocusId || 'MAP');
            }
        }
    }

    dismissCard(id?: string) {
        this.cancelScheduledCard();
        if (!this.activeCard) return;
        if (id && this.activeCard.id !== id) return;

        const returnFocusId = this.activeCard.returnFocusId;
        const wasFocused = FocusManager.getFocus() === this.activeCard.id;
        this.activeCard.onDismiss();
        this.activeCard = null;
        
        if (wasFocused) {
            FocusManager.setFocus(returnFocusId || 'MAP');
        }
    }

    dismissCardIfAnchoredTo(panelElement: HTMLElement) {
        this.cancelScheduledCard();
        if (this.activeCard && this.activeCard.referencePanel === panelElement) {
            this.dismissCard();
        }
    }

    dismissAll() {
        this.cancelScheduledCard();
        this.dismissCard();
        for (const panel of this.expandedPanels.values()) {
            panel.collapse();
        }
        
        const currentFocus = FocusManager.getFocus() as string;
        const overlayFocuses = ['MARKER_CARD', 'QUEST_CARD', 'SETTLEMENT_CARD', 'CUSTOM_MARKER_CARD', 'QUEST_LIST', 'WORKSHOP_LIST', 'SEARCH_PANEL'];
        if (overlayFocuses.includes(currentFocus)) {
            FocusManager.setFocus('MAP');
        }
    }
    
    getActiveCardId(): string | null {
        return this.activeCard ? this.activeCard.id : null;
    }
}

export const OverlayManager = new OverlayManagerSystem();
