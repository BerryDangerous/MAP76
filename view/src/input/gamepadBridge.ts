import { appSettings } from '@/core/settings.js';

export const ControllerStyle = {
    XBOX: 0,
    PLAYSTATION: 1
} as const;
export type ControllerStyle = (typeof ControllerStyle)[keyof typeof ControllerStyle];

const CONTROLLER_DEBOUNCE_MS = 150;
const CONTROLLER_REPEAT_INITIAL_DELAY_MS = 300;
const CONTROLLER_REPEAT_INTERVAL_MS = 100;

class GamepadBridgeSystem {
    public isControllerActive = false;
    public controllerStyle: ControllerStyle | number = ControllerStyle.XBOX;

    private lastRepeatTime = 0;
    private lastPressedTime: Record<string, number> = {};

    public init(): void {
        window.addEventListener('prisma-controller-action', ((e: CustomEvent) => {
            if (!this.isControllerActive) {
                this.isControllerActive = true;
                document.body.classList.add('controller-active');
                window.dispatchEvent(new Event('controlsUpdated'));
            }

            const { action, state } = e.detail;
            if (state !== 'pressed' && state !== 'repeat' && state !== 'released') return;

            const now = Date.now();

            if (state === 'pressed') {
                if (this.lastPressedTime[action] && now - this.lastPressedTime[action] < CONTROLLER_DEBOUNCE_MS) {
                    return;
                }
                this.lastPressedTime[action] = now;
                this.lastRepeatTime = now + CONTROLLER_REPEAT_INITIAL_DELAY_MS;
            } else if (state === 'repeat') {
                if (now - this.lastRepeatTime < CONTROLLER_REPEAT_INTERVAL_MS) return;
                this.lastRepeatTime = now;
            }

            const keyName = `Gamepad_${action}`;
            const syntheticEvent = new KeyboardEvent(state === 'released' ? 'keyup' : 'keydown', {
                key: keyName,
                code: keyName,
                bubbles: true,
                cancelable: true,
                repeat: state === 'repeat'
            });

            const target = document.activeElement || window;
            target.dispatchEvent(syntheticEvent);
        }) as EventListener);

        window.addEventListener('gamepadStateChanged', ((e: CustomEvent<boolean>) => {
            const isGamepad = e.detail;
            if (this.isControllerActive !== isGamepad || this.controllerStyle !== appSettings.controllerStyle) {
                this.isControllerActive = isGamepad;
                this.controllerStyle = appSettings.controllerStyle;
                document.body.classList.toggle('controller-active', isGamepad);
                window.dispatchEvent(new Event('controlsUpdated'));
            }
        }) as EventListener);

        window.addEventListener('settingsUpdated', () => {
            if (this.controllerStyle !== appSettings.controllerStyle) {
                this.controllerStyle = appSettings.controllerStyle;
                window.dispatchEvent(new Event('controlsUpdated'));
            }
        });
    }

    public handleKeyUp(e: KeyboardEvent): void {
        if (!e.key.startsWith('Gamepad_') && this.isControllerActive) {
            this.isControllerActive = false;
            document.body.classList.remove('controller-active');
            window.dispatchEvent(new Event('controlsUpdated'));
        }
    }
}

export const gamepadBridge = new GamepadBridgeSystem();
