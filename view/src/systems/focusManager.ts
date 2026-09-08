import { setMapViewportFocus } from '@/core/bridge.js';

export type FocusOwner = 'MAP' | 'QUEST_LIST' | 'QUEST_CARD' | 'WORKSHOP_LIST' | 'WORKSHOP_CARD' | string;

export type ControlActionDef = import('./keybindManager.js').KeyAction | { action: import('./keybindManager.js').KeyAction, label: string };

export interface FocusComponent {
    id: string;
    /**
     * Returns true if the key event was handled/consumed, false to bubble up.
     */
    handleKeyDown: (e: KeyboardEvent) => boolean;
    handleKeyUp?: (e: KeyboardEvent) => boolean;
    onFocusGained?: () => void;
    onFocusLost?: (newFocusId?: FocusOwner) => void;
    getAvailableControls?: () => ControlActionDef[];
}

type FocusChangeListener = (newFocus: FocusOwner, oldFocus: FocusOwner) => void;

class FocusManagerSystem {
    private currentFocus: FocusOwner = 'MAP';
    private components: Map<string, FocusComponent> = new Map();
    private listeners: Set<FocusChangeListener> = new Set();

    register(component: FocusComponent): void {
        this.components.set(component.id, component);
    }

    unregister(id: string): void {
        this.components.delete(id);
    }

    subscribe(listener: FocusChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getFocus(): FocusOwner {
        return this.currentFocus;
    }

    getActiveComponent(): FocusComponent | undefined {
        return this.components.get(this.currentFocus);
    }

    setFocus(id: FocusOwner): void {
        if (this.currentFocus === id) return;

        const prevFocus = this.currentFocus;
        this.currentFocus = id;

        const prevComponent = this.components.get(prevFocus);
        if (prevComponent && prevComponent.onFocusLost) {
            prevComponent.onFocusLost(id);
        }

        const newComponent = this.components.get(id);
        if (newComponent && newComponent.onFocusGained) {
            newComponent.onFocusGained();
        }

        if (id === 'MAP') {
            document.body.classList.remove('has-active-focus');
            setMapViewportFocus(true);
        } else {
            document.body.classList.add('has-active-focus');
            setMapViewportFocus(false);
        }

        this.listeners.forEach(listener => listener(id, prevFocus));

        console.log(`[FocusManager] Focus shifted to: ${id}`);
    }

    triggerControlsUpdate(): void {
        this.listeners.forEach(listener => listener(this.currentFocus, this.currentFocus));
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

    handleKeyUp(e: KeyboardEvent): boolean {
        const activeComponent = this.components.get(this.currentFocus);
        if (activeComponent && activeComponent.handleKeyUp) {
            const handled = activeComponent.handleKeyUp(e);
            if (handled) {
                return true;
            }
        }
        return false;
    }
}

export const FocusManager = new FocusManagerSystem();
