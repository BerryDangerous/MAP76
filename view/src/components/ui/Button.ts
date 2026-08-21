import { EngineBridge } from '@/core/bridge.js';

export interface ButtonConfig {
    id?: string;
    label: string;
    size?: 'normal' | 'large';
    enabled?: boolean;
    action: () => void;
}

export class Button {
    private container: HTMLElement;
    private labelEl: HTMLSpanElement;
    private config: ButtonConfig;

    constructor(config: ButtonConfig) {
        this.config = { enabled: true, size: 'normal', ...config };
        
        this.container = document.createElement('div');
        this.container.className = 'btn';
        if (this.config.size === 'large') {
            this.container.classList.add('btn-large');
        }
        if (this.config.id) {
            this.container.id = this.config.id;
        }
        this.container.tabIndex = 0;
        
        this.labelEl = document.createElement('span');
        this.labelEl.className = 'btn-text';
        this.labelEl.textContent = this.config.label;
        this.container.appendChild(this.labelEl);

        this.setEnabled(this.config.enabled !== false);

        this.container.addEventListener('click', (e) => {
            if (this.config.enabled !== false) {
                EngineBridge.emitSound('UIMenuOK');
                this.config.action();
            }
        });

        this.container.addEventListener('mouseenter', () => {
            if (this.config.enabled !== false) {
                this.container.focus();
            }
        });

        this.container.addEventListener('focus', () => {
            if (this.config.enabled !== false) {
                EngineBridge.emitSound('UIGeneralFocus');
            }
        });
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    public setEnabled(enabled: boolean) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.container.classList.add('disabled');
            this.container.removeAttribute('tabindex');
        } else {
            this.container.classList.remove('disabled');
            this.container.tabIndex = 0;
        }
    }

    public setText(text: string) {
        this.config.label = text;
        this.labelEl.textContent = text;
    }

    public focus() {
        this.container.focus();
    }
}
