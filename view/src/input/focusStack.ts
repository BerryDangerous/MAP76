import { FocusOwner, InputReceiver, FocusChangeListener } from './types.js';

export class FocusStack {
    private stack: InputReceiver[] = [];
    private listeners: Set<FocusChangeListener> = new Set();

    public push(receiver: InputReceiver): void {
        const currentTop = this.peek();
        if (currentTop?.id === receiver.id) {
            return;
        }

        const existingIndex = this.stack.findIndex(r => r.id === receiver.id);
        if (existingIndex !== -1) {
            this.stack.splice(existingIndex, 1);
        }

        const prevId = currentTop?.id ?? FocusOwner.MAP;
        if (currentTop?.onFocusLost) {
            currentTop.onFocusLost(receiver.id);
        }

        this.stack.push(receiver);

        if (receiver.onFocusGained) {
            receiver.onFocusGained();
        }

        this.updateBodyFocusClass(receiver.id);
        this.notify(receiver.id, prevId);
    }

    public replace(receiver: InputReceiver): void {
        const currentTop = this.peek();
        if (currentTop?.id === receiver.id) {
            return;
        }

        const existingIndex = this.stack.findIndex(r => r.id === receiver.id);
        if (existingIndex !== -1) {
            this.stack.splice(existingIndex, 1);
        }

        const prevId = currentTop?.id ?? FocusOwner.MAP;
        if (currentTop?.onFocusLost) {
            currentTop.onFocusLost(receiver.id);
        }

        if (this.stack.length > 1) {
            this.stack[this.stack.length - 1] = receiver;
        } else {
            this.stack.push(receiver);
        }

        if (receiver.onFocusGained) {
            receiver.onFocusGained();
        }

        this.updateBodyFocusClass(receiver.id);
        this.notify(receiver.id, prevId);
    }

    public pop(): InputReceiver | undefined {
        if (this.stack.length <= 1) {
            return undefined;
        }

        const popped = this.stack.pop()!;
        const newTop = this.peek();

        if (popped.onFocusLost) {
            popped.onFocusLost(newTop?.id);
        }

        if (newTop?.onFocusGained) {
            newTop.onFocusGained();
        }

        const newId = newTop?.id ?? FocusOwner.MAP;
        this.updateBodyFocusClass(newId);
        this.notify(newId, popped.id);

        return popped;
    }

    public peek(): InputReceiver | undefined {
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
    }

    public remove(id: FocusOwner | string): boolean {
        const index = this.stack.findIndex(r => r.id === id);
        if (index === -1) {
            return false;
        }

        if (index === this.stack.length - 1) {
            return this.pop() !== undefined;
        }

        this.stack.splice(index, 1);
        return true;
    }

    public clear(root?: InputReceiver): void {
        const oldTop = this.peek();
        if (root) {
            this.stack = [root];
        } else if (this.stack.length > 0) {
            this.stack = [this.stack[0]];
        } else {
            this.stack = [];
        }

        const newTop = this.peek();
        const newId = newTop?.id ?? FocusOwner.MAP;
        this.updateBodyFocusClass(newId);
        if (oldTop && oldTop.id !== newId) {
            if (oldTop.onFocusLost) oldTop.onFocusLost(newId);
            if (newTop?.onFocusGained) newTop.onFocusGained();
            this.notify(newId, oldTop.id);
        }
    }

    public size(): number {
        return this.stack.length;
    }

    public getStack(): readonly InputReceiver[] {
        return [...this.stack];
    }

    public subscribe(listener: FocusChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    public notify(newFocus: FocusOwner | string, oldFocus: FocusOwner | string): void {
        this.listeners.forEach(listener => listener(newFocus, oldFocus));
    }

    private updateBodyFocusClass(focusId: FocusOwner | string): void {
        if (typeof document === 'undefined') return;
        if (focusId === FocusOwner.MAP) {
            document.body.classList.remove('has-active-focus');
        } else {
            document.body.classList.add('has-active-focus');
        }
    }
}
