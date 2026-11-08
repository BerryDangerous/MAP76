import { FocusOwner, InputReceiver, ControlActionDef, FocusChangeListener } from './types.js';
import { InputRouter } from './inputRouter.js';

export type { FocusOwner, ControlActionDef, FocusChangeListener };

export interface FocusComponent {
    id: string;
    handleKeyDown: (e: KeyboardEvent) => boolean;
    handleKeyUp?: (e: KeyboardEvent) => boolean;
    onFocusGained?: () => void;
    onFocusLost?: (newFocusId?: FocusOwner) => void;
    getAvailableControls?: () => ControlActionDef[];
}

class FocusManagerSystem {
    private components: Map<string, FocusComponent> = new Map();

    register(component: FocusComponent): void {
        this.components.set(component.id, component);

        const adapter: InputReceiver = {
            id: component.id,
            handleAction: () => false,
            onFocusGained: () => component.onFocusGained?.(),
            onFocusLost: (newId) => component.onFocusLost?.(newId),
            getAvailableControls: () => component.getAvailableControls?.() ?? []
        };
        (adapter as any).handleKeyDown = (e: KeyboardEvent) => component.handleKeyDown(e);
        if (component.handleKeyUp) {
            (adapter as any).handleKeyUp = (e: KeyboardEvent) => component.handleKeyUp!(e);
        }

        InputRouter.register(adapter);
    }

    unregister(id: string): void {
        this.components.delete(id);
        InputRouter.unregister(id);
    }

    subscribe(listener: FocusChangeListener): () => void {
        return InputRouter.subscribe(listener);
    }

    getFocus(): FocusOwner {
        return InputRouter.getFocus();
    }

    getActiveComponent(): FocusComponent | undefined {
        return this.components.get(this.getFocus());
    }

    setFocus(id: FocusOwner): void {
        InputRouter.push(id);
    }

    triggerControlsUpdate(): void {
        InputRouter.notifyActionsChanged();
    }

    handleKeyDown(e: KeyboardEvent): boolean {
        return InputRouter.handleKeyDown(e);
    }

    handleKeyUp(e: KeyboardEvent): boolean {
        return InputRouter.handleKeyUp(e);
    }
}

export const FocusManager = new FocusManagerSystem();
