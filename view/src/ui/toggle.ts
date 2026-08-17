import { SettingsControl } from './settingsRow.js';
import { EngineBridge } from '../core/bridge.js';

export class Toggle implements SettingsControl {
    private container: HTMLElement;
    private valueElement: HTMLElement;
    private value: boolean;
    private onChange: (val: boolean) => void;

    constructor(
        initialValue: boolean,
        onChange: (val: boolean) => void
    ) {
        this.value = initialValue;
        this.onChange = onChange;
        
        this.container = document.createElement('div');
        this.container.className = 'stepper-control';

        this.valueElement = document.createElement('div');
        this.valueElement.className = 'ui-control-value';
        
        this.build();
    }

    public setValue(val: boolean, triggerOnChange: boolean = false) {
        this.value = val;
        this.updateValueText();
        if (triggerOnChange) {
            this.onChange(this.value);
        }
    }

    private build() {
        const leftArrow = document.createElement('div');
        leftArrow.className = 'stepper-arrow stepper-arrow-left';
        leftArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        const rightArrow = document.createElement('div');
        rightArrow.className = 'stepper-arrow stepper-arrow-right';
        rightArrow.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.updateValueText();

        this.container.appendChild(leftArrow);
        this.container.appendChild(this.valueElement);
        this.container.appendChild(rightArrow);

        this.container.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
    }

    private toggle() {
        EngineBridge.emitSound('UIMenuOK');
        this.value = !this.value;
        this.updateValueText();
        this.onChange(this.value);
    }

    private updateValueText() {
        this.valueElement.textContent = this.value ? 'ON' : 'OFF';
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public handleKey(e: KeyboardEvent): boolean {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            this.toggle();
            return true;
        }
        return false;
    }
}
