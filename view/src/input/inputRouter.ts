import { KeyAction, FocusOwner, InputReceiver, FocusChangeListener } from './types.js';
import { FocusStack } from './focusStack.js';
import { isAction } from './keymap.js';
import { gamepadBridge } from './gamepadBridge.js';

export type CloseMapHandler = () => void;

const ALL_KEY_ACTIONS: KeyAction[] = [
    KeyAction.NAV_BACK,
    KeyAction.SELECT,
    KeyAction.OPEN_MENU,
    KeyAction.OPEN_SETTINGS,
    KeyAction.CLOSE_MAP,
    KeyAction.TAB_PREV,
    KeyAction.TAB_NEXT,
    KeyAction.NAV_UP,
    KeyAction.NAV_DOWN,
    KeyAction.NAV_LEFT,
    KeyAction.NAV_RIGHT,
    KeyAction.COLLAPSE,
    KeyAction.PLACE_MARKER,
    KeyAction.ZOOM_IN,
    KeyAction.ZOOM_OUT,
    KeyAction.PAN_MOUSE,
    KeyAction.CENTER_CAMERA,
    KeyAction.CENTER_ITEM,
    KeyAction.RESET_DEFAULTS,
    KeyAction.TOGGLE_ACTIVE,
    KeyAction.TOGGLE_SUPPLY_LINES,
    KeyAction.PREV_WORLD,
    KeyAction.NEXT_WORLD,
    KeyAction.SORT,
    KeyAction.CHANGE_LAYOUT
];

export class InputRouterSystem {
    private readonly stack = new FocusStack();
    private readonly receivers = new Map<FocusOwner, InputReceiver>();
    private closeMapHandler: CloseMapHandler | null = null;
    private initialized = false;

    public getFocusStack(): FocusStack {
        return this.stack;
    }

    public setCloseMapHandler(handler: CloseMapHandler | null): void {
        this.closeMapHandler = handler;
    }

    public register(receiver: InputReceiver): void {
        this.receivers.set(receiver.id, receiver);
    }

    public unregister(id: FocusOwner): void {
        this.receivers.delete(id);
        this.stack.remove(id);
    }

    public push(target: InputReceiver | FocusOwner): void {
        if (typeof target === 'string') {
            const receiver = this.receivers.get(target);
            if (receiver) {
                this.stack.push(receiver);
            } else {
                console.warn(`[InputRouter] Cannot push unregistered receiver id: ${target}`);
            }
        } else {
            this.register(target);
            this.stack.push(target);
        }
    }

    public replace(target: InputReceiver | FocusOwner): void {
        if (typeof target === 'string') {
            const receiver = this.receivers.get(target);
            if (receiver) {
                this.stack.replace(receiver);
            } else {
                console.warn(`[InputRouter] Cannot replace unregistered receiver id: ${target}`);
            }
        } else {
            this.register(target);
            this.stack.replace(target);
        }
    }

    public pop(): InputReceiver | undefined {
        return this.stack.pop();
    }

    public remove(id: FocusOwner): boolean {
        return this.stack.remove(id);
    }

    public peek(): InputReceiver | undefined {
        return this.stack.peek();
    }

    public getFocus(): FocusOwner {
        return this.stack.peek()?.id ?? FocusOwner.MAP;
    }

    public getActiveReceiver(): InputReceiver | undefined {
        return this.stack.peek();
    }

    public subscribe(listener: FocusChangeListener): () => void {
        return this.stack.subscribe(listener);
    }

    public notifyActionsChanged(): void {
        const top = this.stack.peek();
        const topId = top?.id ?? FocusOwner.MAP;
        this.stack.notify(topId, topId);
    }

    public init(): void {
        if (this.initialized || typeof window === 'undefined') return;
        this.initialized = true;

        gamepadBridge.init();

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (this.isTypingInTextInput(e)) {
                return;
            }

            this.handleKeyDown(e);
            e.preventDefault();
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            gamepadBridge.handleKeyUp(e);
            const handled = this.handleKeyUp(e);
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    public handleKeyDown(e: KeyboardEvent): boolean {
        if (this.isTypingInTextInput(e)) {
            return false;
        }

        const activeReceiver = this.stack.peek();
        if (!activeReceiver) {
            return false;
        }

        if (this.isMenuExitKey(e)) {
            return this.handleMenuExit(e, activeReceiver);
        }

        return this.dispatchActionToReceiver(e, activeReceiver);
    }

    public handleKeyUp(e: KeyboardEvent): boolean {
        const activeReceiver = this.stack.peek();
        if (activeReceiver && activeReceiver.handleActionRelease) {
            const matchingActions = this.getMatchingActions(e);
            for (const action of matchingActions) {
                if (activeReceiver.handleActionRelease(action)) {
                    e.preventDefault();
                    return true;
                }
            }
        }

        const legacyReceiver = activeReceiver as { handleKeyUp?: (e: KeyboardEvent) => boolean } | undefined;
        if (legacyReceiver?.handleKeyUp && legacyReceiver.handleKeyUp(e)) {
            e.preventDefault();
            return true;
        }

        return false;
    }

    public triggerCloseMap(): void {
        if (this.closeMapHandler) {
            this.closeMapHandler();
        }
    }

    private isTypingInTextInput(e: KeyboardEvent): boolean {
        const activeEl = document.activeElement as HTMLElement | null;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
        if (!isInput) return false;

        const structuralKeys = ['Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown'];
        return !structuralKeys.includes(e.key) && !e.key.startsWith('Gamepad_');
    }

    private isMenuExitKey(e: KeyboardEvent): boolean {
        return e.key === 'Escape' ||
               e.code === 'Escape' ||
               isAction(e, KeyAction.OPEN_MENU) ||
               isAction(e, KeyAction.NAV_BACK);
    }

    private handleMenuExit(e: KeyboardEvent, activeReceiver: InputReceiver): boolean {
        e.preventDefault();
        e.stopPropagation();

        if (activeReceiver.handleAction(KeyAction.NAV_BACK)) {
            return true;
        }

        const legacyReceiver = activeReceiver as { handleKeyDown?: (e: KeyboardEvent) => boolean };
        if (legacyReceiver.handleKeyDown?.(e)) {
            return true;
        }

        if (activeReceiver.id === FocusOwner.MAP) {
            this.triggerCloseMap();
            return true;
        }

        this.pop();
        return true;
    }

    private dispatchActionToReceiver(e: KeyboardEvent, activeReceiver: InputReceiver): boolean {
        const matchingActions = this.getMatchingActions(e);
        for (const action of matchingActions) {
            if (action === KeyAction.CLOSE_MAP && e.repeat) {
                continue;
            }
            if (activeReceiver.handleAction(action)) {
                e.preventDefault();
                return true;
            }
        }

        const legacyReceiver = activeReceiver as { handleKeyDown?: (e: KeyboardEvent) => boolean };
        if (legacyReceiver.handleKeyDown?.(e)) {
            e.preventDefault();
            return true;
        }

        return true;
    }

    private getMatchingActions(e: KeyboardEvent): KeyAction[] {
        return ALL_KEY_ACTIONS.filter(action => isAction(e, action));
    }
}

export const InputRouter = new InputRouterSystem();
