export interface ActionButtonConfig {
    id: string;
    label: string;
    badge?: string;
    enabled?: boolean;
    action: () => void;
}

export class ActionButtonGroup {
    private buttons: ActionButtonConfig[] = [];
    private selectedIndex: number = 0;
    private container: HTMLElement | null = null;
    private onChangeCallback?: (index: number, btn: ActionButtonConfig) => void;

    constructor(buttons: ActionButtonConfig[] = []) {
        this.setButtons(buttons);
    }

    public setButtons(buttons: ActionButtonConfig[]): void {
        this.buttons = buttons;
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, buttons.length - 1));
        if (this.container) {
            this.render();
        }
    }

    public mount(container: HTMLElement, onChange?: (index: number, btn: ActionButtonConfig) => void): void {
        this.container = container;
        this.onChangeCallback = onChange;
        this.render();
    }

    public getSelectedIndex(): number {
        return this.selectedIndex;
    }

    public setSelectedIndex(index: number): void {
        if (index >= 0 && index < this.buttons.length) {
            this.selectedIndex = index;
            this.updateSelectionState();
            if (this.onChangeCallback && this.buttons[index]) {
                this.onChangeCallback(this.selectedIndex, this.buttons[this.selectedIndex]);
            }
        }
    }

    public navigateNext(): void {
        if (this.buttons.length === 0) return;
        const nextIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
        this.setSelectedIndex(nextIndex);
    }

    public navigatePrev(): void {
        if (this.buttons.length === 0) return;
        const prevIndex = Math.max(0, this.selectedIndex - 1);
        this.setSelectedIndex(prevIndex);
    }

    public triggerSelected(): void {
        const current = this.buttons[this.selectedIndex];
        if (current && current.enabled !== false) {
            current.action();
        }
    }

    public handleKeyDown(e: KeyboardEvent): boolean {
        if (e.key === 'ArrowDown') {
            this.navigateNext();
            return true;
        }
        if (e.key === 'ArrowUp') {
            this.navigatePrev();
            return true;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            this.triggerSelected();
            return true;
        }
        return false;
    }

    public render(): void {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.buttons.forEach((btn, index) => {
            const btnEl = document.createElement('div');
            btnEl.className = 'qc-action-btn';
            if (index === this.selectedIndex) {
                btnEl.classList.add('selected');
            }
            if (btn.enabled === false) {
                btnEl.classList.add('disabled');
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'qc-btn-text';
            labelSpan.textContent = btn.label;
            btnEl.appendChild(labelSpan);

            if (btn.badge) {
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'qc-btn-badge';
                badgeSpan.textContent = btn.badge;
                btnEl.appendChild(badgeSpan);
            }

            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setSelectedIndex(index);
                this.triggerSelected();
            });

            this.container!.appendChild(btnEl);
        });
    }

    private updateSelectionState(): void {
        if (!this.container) return;
        const children = Array.from(this.container.children);
        children.forEach((child, index) => {
            if (index === this.selectedIndex) {
                child.classList.add('selected');
            } else {
                child.classList.remove('selected');
            }
        });
    }
}
