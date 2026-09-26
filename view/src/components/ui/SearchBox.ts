import { EngineBridge } from '@/core/bridge.js';
import { t } from '@/core/i18n.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';
import { LayoutManager } from '@/systems/layoutManager.js';

export interface SearchBoxOptions {
    container: HTMLElement;
    placeholder?: string;
    initialValue?: string;
    onInput?: (text: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export class SearchBox {
    private container: HTMLElement;
    private wrapperEl!: HTMLElement;
    private inputEl!: HTMLInputElement;
    private clearBtnEl!: HTMLElement;
    private options: SearchBoxOptions;

    constructor(options: SearchBoxOptions) {
        this.options = options;
        this.container = options.container;
        this.init();
    }

    private init(): void {
        this.wrapperEl = document.createElement('div');
        this.wrapperEl.className = 'search-box-wrapper';

        this.inputEl = document.createElement('input');
        this.inputEl.type = 'text';
        this.inputEl.className = 'search-box-input';
        this.inputEl.setAttribute('spellcheck', 'false');

        this.clearBtnEl = document.createElement('div');
        this.clearBtnEl.className = 'search-box-clear-btn';
        this.clearBtnEl.textContent = t('search.clear', { defaultValue: 'CLEAR' });
        this.clearBtnEl.tabIndex = -1;
        
        if (this.options.placeholder) {
            this.inputEl.placeholder = this.options.placeholder;
        }

        if (this.options.initialValue) {
            this.inputEl.value = this.options.initialValue;
        }

        this.inputEl.addEventListener('input', () => {
            this.updateClearBtnVisibility();
            if (this.options.onInput) {
                this.options.onInput(this.inputEl.value);
            }
        });

        this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (KeybindsSystem.isAction(e, 'NAV_RIGHT') && this.inputEl.selectionStart === this.inputEl.value.length && this.inputEl.value.length > 0) {
                this.clearBtnEl.focus();
                e.preventDefault();
                e.stopPropagation();
            }
        });

        this.inputEl.addEventListener('focus', () => {
            if (KeybindsSystem.isControllerActive && window.PrismaOSK && !window.PrismaOSK.isOpen()) {
                window.PrismaOSK.open(this.inputEl);
            }
        });

        this.clearBtnEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (KeybindsSystem.isAction(e, 'NAV_LEFT')) {
                this.inputEl.focus();
                e.preventDefault();
                e.stopPropagation();
            } else if (KeybindsSystem.isAction(e, 'SELECT')) {
                EngineBridge.emitSound('UIMenuCancel');
                this.clear();
                setTimeout(() => this.inputEl.focus(), 0);
                e.preventDefault();
                e.stopPropagation();
            }
        });

        this.clearBtnEl.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            EngineBridge.emitSound('UIMenuCancel');
            this.clear();
            this.inputEl.focus();
        });

        this.clearBtnEl.addEventListener('mouseenter', () => {
            this.clearBtnEl.focus();
        });

        this.clearBtnEl.addEventListener('focus', () => {
            EngineBridge.emitSound('UIGeneralFocus');
        });

        this.wrapperEl.addEventListener('focusin', (e: FocusEvent) => {
            const oldTarget = e.relatedTarget as Node;
            if (!this.wrapperEl.contains(oldTarget)) {
                if (this.options.onFocus) {
                    this.options.onFocus();
                }
            }
        });

        this.wrapperEl.addEventListener('focusout', (e: FocusEvent) => {
            const newTarget = e.relatedTarget as Node;
            if (!this.wrapperEl.contains(newTarget)) {
                if (this.options.onBlur) {
                    this.options.onBlur();
                }
            }
        });

        this.wrapperEl.appendChild(this.inputEl);
        this.wrapperEl.appendChild(this.clearBtnEl);
        this.container.appendChild(this.wrapperEl);

        this.updateClearBtnVisibility();

        if (window.PrismaOSK) {
            const host = document.getElementById('prisma-osk-host');
            if (host) {
                window.PrismaOSK.bindHost(host);

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'hidden') {
                            window.dispatchEvent(new CustomEvent('controlsUpdated'));
                            
                            if (!host.hidden) {
                                const searchPanel = document.getElementById('search-panel');
                                if (searchPanel) {
                                    const dockCorner = (searchPanel.getAttribute('data-dock') as any) || 'top-left';
                                    LayoutManager.anchorToPanel(host, searchPanel, dockCorner, 10);
                                }
                            }
                        }
                    });
                });
                observer.observe(host, { attributes: true });
                
                window.addEventListener('controlsUpdated', () => {
                    if (!KeybindsSystem.isControllerActive && window.PrismaOSK && window.PrismaOSK.isOpen()) {
                        window.PrismaOSK.close({ commit: true });
                    }
                });
            }

            window.addEventListener('prisma-controller-action', (e: any) => {
                if (window.PrismaOSK && window.PrismaOSK.isOpen() && e.detail?.state === 'pressed') {
                    const btn = e.detail.button;
                    if (btn !== 'B' && !btn.startsWith('DPad') && btn !== 'LeftThumb' && btn !== 'RightThumb') {
                        EngineBridge.emitSound('UIGeneralFocus');
                    }
                }
            }, true);
            
            // Intercept B button to commit instead of cancel, and trigger NAV_BACK
            window.addEventListener('prisma-controller-action', (e: any) => {
                if (e.detail && e.detail.button === 'B' && window.PrismaOSK && window.PrismaOSK.isOpen()) {
                    if (document.activeElement === this.inputEl) {
                        e.stopImmediatePropagation();
                        
                        if (e.detail.state === 'pressed') {
                            window.PrismaOSK.close({ commit: true });                            
                            const ev = new KeyboardEvent('keydown', { key: 'Gamepad_B', bubbles: true, cancelable: true });
                            window.dispatchEvent(ev);
                        }
                    }
                }
            }, true);
        }
    }

    public clear(): void {
        this.inputEl.value = '';
        this.updateClearBtnVisibility();
        this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    private updateClearBtnVisibility(): void {
        this.clearBtnEl.style.display = this.inputEl.value.length > 0 ? 'block' : 'none';
    }

    public focus(cursorAtEnd: boolean = true): void {
        this.inputEl.focus();
        if (cursorAtEnd) {
            setTimeout(() => {
                const len = this.inputEl.value.length;
                this.inputEl.setSelectionRange(len, len);
            }, 10);
        }
    }

    public blur(): void {
        if (document.activeElement === this.inputEl) {
            this.inputEl.blur();
        } else if (document.activeElement === this.clearBtnEl) {
            this.clearBtnEl.blur();
        }
    }

    public isFocused(): boolean {
        return document.activeElement === this.inputEl || document.activeElement === this.clearBtnEl;
    }

    public getValue(): string {
        return this.inputEl.value;
    }

    public setValue(value: string): void {
        this.inputEl.value = value;
    }

    public getInputElement(): HTMLInputElement {
        return this.inputEl;
    }
}
