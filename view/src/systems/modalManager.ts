import { ActionButtonGroup } from '../ui/actionButton.js';
import { ButtonConfig } from '../ui/button.js';

export interface ModalConfig {
    text: string;
    buttons: ButtonConfig[];
}

export class ModalManager {
    private static activeOverlay: HTMLElement | null = null;
    private static activeKeydownListener: ((e: KeyboardEvent) => void) | null = null;
    private static buttonGroup: ActionButtonGroup | null = null;

    public static show(config: ModalConfig): void {
        this.close();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.display = 'flex';

        const modalBox = document.createElement('div');
        modalBox.className = 'modal-box';

        const textEl = document.createElement('p');
        textEl.id = 'modal-text';
        textEl.innerHTML = config.text.replace(/\n/g, '<br>');

        const actions = document.createElement('div');
        actions.className = 'modal-actions';

        this.buttonGroup = new ActionButtonGroup({
            buttons: config.buttons,
            layout: 'row',
            size: 'normal'
        });

        this.buttonGroup.mount(actions);

        modalBox.appendChild(textEl);
        modalBox.appendChild(actions);
        overlay.appendChild(modalBox);

        document.body.appendChild(overlay);
        this.activeOverlay = overlay;

        this.activeKeydownListener = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.buttonGroup) {
                this.buttonGroup.handleKeyDown(e);
            }
        };
        
        window.addEventListener('keydown', this.activeKeydownListener, true);
    }

    public static close(): void {
        if (this.buttonGroup) {
            this.buttonGroup.destroy();
            this.buttonGroup = null;
        }

        if (this.activeOverlay) {
            this.activeOverlay.remove();
            this.activeOverlay = null;
        }

        if (this.activeKeydownListener) {
            window.removeEventListener('keydown', this.activeKeydownListener, true);
            this.activeKeydownListener = null;
        }
    }
}
