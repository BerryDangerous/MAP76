import { EngineBridge } from '@/core/bridge.js';

import { KeybindsSystem } from '@/systems/keybindManager.js';

export interface TabItem<T = string> {
    id: T;
    label: string;
}

export interface TabBarOptions<T = string> {
    tabs: TabItem<T>[];
    activeTabId: T;
    onTabChange: (tabId: T, tab: TabItem<T>) => void;
}

export class TabBar<T = string> {
    private options: TabBarOptions<T>;
    private container: HTMLElement | null = null;

    constructor(options: TabBarOptions<T>) {
        this.options = options;
    }

    public mount(container: HTMLElement): void {
        this.container = container;
        this.render();
        
        window.addEventListener('controlsUpdated', () => {
            this.updateIcons();
        });
    }

    private updateIcons(): void {
        if (!this.container || !this.container.parentElement) return;
        const icons = this.container.parentElement.querySelectorAll('.tb-nav-icon');
        if (icons.length >= 2) {
            icons[0].innerHTML = KeybindsSystem.getActionGlyphHtml('TAB_PREV');
            icons[icons.length - 1].innerHTML = KeybindsSystem.getActionGlyphHtml('TAB_NEXT');
        }
    }

    public updateTabs(newTabs: TabItem<T>[]): void {
        this.options.tabs = newTabs;
        this.render();
    }

    public setActiveTab(tabId: T): void {
        if (this.options.activeTabId === tabId) return;
        const targetTab = this.options.tabs.find(t => t.id === tabId);
        if (!targetTab) return;

        this.options.activeTabId = tabId;
        this.updateDOMSelection();
        this.options.onTabChange(tabId, targetTab);
    }

    public getActiveTabId(): T {
        return this.options.activeTabId;
    }

    public nextTab(): void {
        const currentIndex = this.options.tabs.findIndex(t => t.id === this.options.activeTabId);
        if (currentIndex < this.options.tabs.length - 1) {
            EngineBridge.emitSound('UIPipBoyRotaryVerticalUp');
            this.setActiveTab(this.options.tabs[currentIndex + 1].id);
        }
    }

    public prevTab(): void {
        const currentIndex = this.options.tabs.findIndex(t => t.id === this.options.activeTabId);
        if (currentIndex > 0) {
            EngineBridge.emitSound('UIPipBoyRotaryVerticalDown');
            this.setActiveTab(this.options.tabs[currentIndex - 1].id);
        }
    }

    public handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'TAB_NEXT')) {
            this.nextTab();
            return true;
        }
        if (KeybindsSystem.isAction(e, 'TAB_PREV')) {
            this.prevTab();
            return true;
        }
        return false;
    }

    public render(): void {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.options.tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = 'tb-tab';
            if (tab.id === this.options.activeTabId) {
                tabEl.classList.add('active');
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'tb-tab-text';
            textSpan.textContent = tab.label;
            tabEl.appendChild(textSpan);

            tabEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setActiveTab(tab.id);
            });

            this.container!.appendChild(tabEl);
        });

        this.updateIcons();
    }

    private updateDOMSelection(): void {
        if (!this.container) return;
        const children = Array.from(this.container.children);
        this.options.tabs.forEach((tab, index) => {
            const child = children[index];
            if (!child) return;
            if (tab.id === this.options.activeTabId) {
                child.classList.add('active');
            } else {
                child.classList.remove('active');
            }
        });
    }
}
