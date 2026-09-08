import { EngineBridge } from '@/core/bridge.js';

export interface SettingsControl {
    getElement(): HTMLElement;
    setValue(val: any): void;
    handleKey(e: KeyboardEvent): boolean;
}

export class SettingsRow {
    private container: HTMLElement;

    constructor(
        private labelText: string,
        public control: SettingsControl
    ) {
        this.container = document.createElement('div');
        this.container.className = 'settings-row';
        this.container.tabIndex = 0;

        this.build();

        this.container.addEventListener('mouseenter', () => {
            this.container.focus();
        });

        this.container.addEventListener('focus', () => {
            EngineBridge.emitSound('UIGeneralFocus');
        });
    }

    private build() {
        const leftSide = document.createElement('div');
        leftSide.className = 'settings-row-left';
        
        const title = document.createElement('span');
        title.className = 'settings-row-title';
        title.textContent = this.labelText;
        leftSide.appendChild(title);

        const rightSide = document.createElement('div');
        rightSide.className = 'settings-row-right';
        rightSide.appendChild(this.control.getElement());

        this.container.appendChild(leftSide);
        this.container.appendChild(rightSide);
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public focus(): void {
        this.container.focus();
    }

    public blur(): void {
        this.container.blur();
    }
}
