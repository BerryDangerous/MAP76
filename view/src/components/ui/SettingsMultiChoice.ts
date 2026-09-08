import { EngineBridge } from '@/core/bridge.js';

import { SettingsControl } from '@/components/ui/SettingsRow.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';

export class MultiChoice<T> implements SettingsControl {
    private container: HTMLElement;
    private valueElement: HTMLElement;
    private leftArrow!: HTMLElement;
    private rightArrow!: HTMLElement;
    
    private options: { label: string; value: T }[];
    private currentIndex: number;
    private onChange: (val: T) => void;

    constructor(
        options: { label: string; value: T }[],
        initialValue: T,
        onChange: (val: T) => void
    ) {
        this.options = options;
        
        const initialIndex = options.findIndex(opt => opt.value === initialValue);
        this.currentIndex = Math.max(0, initialIndex);
        this.onChange = onChange;
        
        this.container = document.createElement('div');
        this.container.className = 'stepper-control';

        this.valueElement = document.createElement('div');
        this.valueElement.className = 'ui-control-value';
        
        this.build();
    }

    public setValue(val: T, triggerOnChange: boolean = false) {
        const idx = this.options.findIndex(opt => opt.value === val);
        if (idx !== -1) {
            this.currentIndex = idx;
            this.updateValueText();
            if (triggerOnChange) {
                this.onChange(this.options[this.currentIndex].value);
            }
        }
    }

    private build() {
        this.leftArrow = document.createElement('div');
        this.leftArrow.className = 'stepper-arrow stepper-arrow-left';
        this.leftArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });

        this.rightArrow = document.createElement('div');
        this.rightArrow.className = 'stepper-arrow stepper-arrow-right';
        this.rightArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });

        this.updateValueText();

        this.container.appendChild(this.leftArrow);
        this.container.appendChild(this.valueElement);
        this.container.appendChild(this.rightArrow);

        this.container.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });
    }

    private prev() {
        if (this.currentIndex > 0) {
            EngineBridge.emitSound('UIMenuOK');
            this.currentIndex--;
            this.updateValueText();
            this.onChange(this.options[this.currentIndex].value);
        }
    }

    private next() {
        if (this.currentIndex < this.options.length - 1) {
            EngineBridge.emitSound('UIMenuOK');
            this.currentIndex++;
            this.updateValueText();
            this.onChange(this.options[this.currentIndex].value);
        }
    }

    private updateValueText() {
        this.valueElement.textContent = this.options[this.currentIndex].label;
        if (this.leftArrow) {
            this.leftArrow.style.visibility = this.currentIndex === 0 ? 'hidden' : 'visible';
        }
        if (this.rightArrow) {
            this.rightArrow.style.visibility = this.currentIndex === this.options.length - 1 ? 'hidden' : 'visible';
        }
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public handleKey(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'NAV_LEFT')) {
            this.prev();
            return true;
        } else if (KeybindsSystem.isAction(e, 'NAV_RIGHT') || KeybindsSystem.isAction(e, 'SELECT')) {
            this.next();
            return true;
        }
        return false;
    }
}
