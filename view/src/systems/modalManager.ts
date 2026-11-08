import { ControlActionDef, FocusOwner, InputReceiver, InputRouter, KeyAction } from '@/input/index.js';
import { SoundService } from '@/services/soundService.js';
import { ActionButtonGroup, type ButtonConfig } from '@/ui/index.js';

export interface ModalConfig {
    text: string;
    buttons: ButtonConfig[];
}

const DISMISS_UX_DELAY_MS = 120;
const CANCEL_BUTTON_INDEX = 1;
const DEFAULT_BUTTON_INDEX = 0;

export class ModalManager {
    private static activeOverlay: HTMLElement | null = null;
    private static buttonGroup: ActionButtonGroup | null = null;
    private static previousFocus: HTMLElement | null = null;
    private static currentConfig: ModalConfig | null = null;
    private static isDismissing: boolean = false;
    private static dismissTimer: ReturnType<typeof setTimeout> | null = null;

    private static receiver: InputReceiver = {
        id: FocusOwner.MODAL,
        handleAction: (action: KeyAction) => ModalManager.handleAction(action),
        getAvailableControls: () => ModalManager.getAvailableControls()
    };

    public static show(config: ModalConfig): void {
        this.close();
        this.previousFocus = document.activeElement as HTMLElement | null;
        this.currentConfig = config;
        this.isDismissing = false;

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
        this.buttonGroup.setSelectedIndex(DEFAULT_BUTTON_INDEX);

        InputRouter.push(this.receiver);
    }

    public static close(): void {
        if (this.dismissTimer !== null) {
            clearTimeout(this.dismissTimer);
            this.dismissTimer = null;
        }

        if (this.buttonGroup) {
            this.buttonGroup.destroy();
            this.buttonGroup = null;
        }

        if (this.activeOverlay) {
            this.activeOverlay.remove();
            this.activeOverlay = null;
        }

        InputRouter.getFocusStack().remove(FocusOwner.MODAL);
        this.currentConfig = null;
        this.isDismissing = false;

        if (this.previousFocus) {
            this.previousFocus.focus();
            this.previousFocus = null;
        }
    }

    private static handleAction(action: KeyAction): boolean {
        if (this.isDismissing) {
            return true;
        }

        if (!this.buttonGroup) {
            return true;
        }

        switch (action) {
            case KeyAction.NAV_LEFT:
            case KeyAction.NAV_UP:
                this.buttonGroup.navigatePrev();
                return true;

            case KeyAction.NAV_RIGHT:
            case KeyAction.NAV_DOWN:
                this.buttonGroup.navigateNext();
                return true;

            case KeyAction.SELECT:
                this.buttonGroup.triggerSelected();
                return true;

            case KeyAction.NAV_BACK:
            case KeyAction.OPEN_MENU:
                this.dismissWithVisualFeedback();
                return true;

            default:
                return false;
        }
    }

    private static dismissWithVisualFeedback(): void {
        if (this.isDismissing) return;
        this.isDismissing = true;

        const buttons = this.currentConfig?.buttons;
        if (!buttons || buttons.length === 0) {
            this.close();
            return;
        }

        SoundService.playCancel();

        if (buttons.length > 1) {
            this.buttonGroup?.setSelectedIndex(CANCEL_BUTTON_INDEX);
            this.dismissTimer = setTimeout(() => {
                this.dismissTimer = null;
                const cancelBtn = buttons[CANCEL_BUTTON_INDEX];
                if (cancelBtn) {
                    cancelBtn.action();
                } else {
                    this.close();
                }
            }, DISMISS_UX_DELAY_MS);
        } else {
            const defaultBtn = buttons[DEFAULT_BUTTON_INDEX];
            if (defaultBtn) {
                defaultBtn.action();
            } else {
                this.close();
            }
        }
    }

    private static getAvailableControls(): ControlActionDef[] {
        const buttons = this.currentConfig?.buttons;
        if (buttons && buttons.length > 1) {
            return [KeyAction.NAV_BACK, KeyAction.SELECT, KeyAction.NAV_LEFT, KeyAction.NAV_RIGHT];
        }
        return [KeyAction.NAV_BACK, KeyAction.SELECT];
    }
}
