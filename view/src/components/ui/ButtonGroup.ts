import { KeybindsSystem } from '@/systems/keybindManager.js';
import { SoundService } from '@/services/soundService.js';

import { Button, ButtonConfig } from '@/components/ui/Button.js';

export type ActionButtonConfig = ButtonConfig;

export interface ActionButtonGroupConfig {
    buttons?: ButtonConfig[];
    layout?: 'row' | 'column';
    size?: 'normal' | 'large';
    selectable?: boolean;
}

export class ActionButtonGroup {
    private buttons: Button[] = [];
    private configs: ButtonConfig[] = [];
    private selectedIndex: number = 0;
    private container: HTMLElement | null = null;
    private onChangeCallback?: (index: number, btn: ButtonConfig) => void;
    private layout: 'row' | 'column';
    private size: 'normal' | 'large';
    private selectable: boolean;

    constructor(config: ActionButtonGroupConfig = {}) {
        this.layout = config.layout || 'column';
        this.size = config.size || 'normal';
        this.selectable = config.selectable !== false;
        if (config.buttons) {
            this.setButtons(config.buttons);
        }
    }

    public setButtons(buttons: ButtonConfig[]): void {
        this.configs = buttons;
        this.buttons = buttons.map(cfg => new Button({ ...cfg, size: this.size }));
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, buttons.length - 1));
        if (this.container) {
            this.render();
        }
    }

    public mount(container: HTMLElement, onChange?: (index: number, btn: ButtonConfig) => void): void {
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
            
            const btnEl = this.buttons[this.selectedIndex].getElement();
            if (btnEl && this.selectable) {
                btnEl.focus();
            }

            if (this.onChangeCallback && this.configs[index]) {
                this.onChangeCallback(this.selectedIndex, this.configs[this.selectedIndex]);
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
        const current = this.configs[this.selectedIndex];
        if (current && current.enabled !== false) {
            SoundService.playAccept();
            current.action();
        }
    }

    public handleKeyDown(e: KeyboardEvent): boolean {
        const nextAction = this.layout === 'row' ? 'NAV_RIGHT' : 'NAV_DOWN';
        const prevAction = this.layout === 'row' ? 'NAV_LEFT' : 'NAV_UP';

        if (KeybindsSystem.isAction(e, nextAction)) {
            this.navigateNext();
            return true;
        }
        if (KeybindsSystem.isAction(e, prevAction)) {
            this.navigatePrev();
            return true;
        }
        if (KeybindsSystem.isAction(e, 'SELECT')) {
            this.triggerSelected();
            return true;
        }
        return false;
    }

    public render(): void {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = this.layout;
        this.container.style.gap = '6px';
        
        this.buttons.forEach((btn, index) => {
            const btnEl = btn.getElement();
            btnEl.addEventListener('mouseenter', () => this.setSelectedIndex(index));
            this.container!.appendChild(btnEl);
        });

        this.updateSelectionState();
    }

    private updateSelectionState(): void {
        if (!this.container) return;
        
        this.buttons.forEach((btn, index) => {
            const btnEl = btn.getElement();
            if (this.selectable && index === this.selectedIndex) {
                btnEl.classList.add('selected');
            } else {
                btnEl.classList.remove('selected');
            }
        });
    }

    public destroy(): void {
        if (this.container) {
            this.container.innerHTML = '';
            this.container = null;
        }
    }
}
