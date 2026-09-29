import { FocusManager } from '@/systems/focusManager.js';

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

    openCard(id: string, options: { 
        cardElement: HTMLElement | null, 
        referencePanel?: HTMLElement | null, 
        onDismiss: () => void,
        takeFocus?: boolean,
        returnFocusId?: string
    }) {
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
        if (this.activeCard && this.activeCard.referencePanel === panelElement) {
            this.dismissCard();
        }
    }

    dismissAll() {
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
