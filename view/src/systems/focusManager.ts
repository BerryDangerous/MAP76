export type FocusOwner = 'MAP' | 'QUEST_LIST' | 'QUEST_CARD' | 'WORKSHOP_LIST' | 'WORKSHOP_CARD' | string;

export interface FocusComponent {
    id: string;
    /**
     * Returns true if the key event was handled/consumed, false to bubble up.
     */
    handleKeyDown: (e: KeyboardEvent) => boolean;
    onFocusGained?: () => void;
    onFocusLost?: () => void;
}

class FocusManagerSystem {
    private currentFocus: FocusOwner = 'MAP';
    private components: Map<string, FocusComponent> = new Map();

    register(component: FocusComponent): void {
        this.components.set(component.id, component);
    }

    unregister(id: string): void {
        this.components.delete(id);
    }

    getFocus(): FocusOwner {
        return this.currentFocus;
    }

    setFocus(id: FocusOwner): void {
        if (this.currentFocus === id) return;

        const prevComponent = this.components.get(this.currentFocus);
        if (prevComponent && prevComponent.onFocusLost) {
            prevComponent.onFocusLost();
        }

        this.currentFocus = id;

        const newComponent = this.components.get(id);
        if (newComponent && newComponent.onFocusGained) {
            newComponent.onFocusGained();
        }

        console.log(`[FocusManager] Focus shifted to: ${id}`);
    }

    handleKeyDown(e: KeyboardEvent): boolean {
        const activeComponent = this.components.get(this.currentFocus);
        if (activeComponent) {
            const handled = activeComponent.handleKeyDown(e);
            if (handled) {
                return true;
            }
        }
        return false;
    }
}

export const FocusManager = new FocusManagerSystem();
