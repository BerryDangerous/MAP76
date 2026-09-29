import { KeybindsSystem } from '@/systems/keybindManager.js';
import { SoundService } from '@/services/soundService.js';

export interface ListNavigationOptions<T> {
    getItems: () => T[];
    getItemId: (item: T) => string | number;
    onSelectionChange?: (selectedItem: T | null, index: number) => void;
    onItemClick?: (item: T, index: number) => void;
    onItemHover?: (item: T | null, index: number) => void;
    containerSupplier: () => HTMLElement | null;
    itemSelector?: string;
}

export class SelectableListController<T> {
    private selectedId: string | number | null = null;
    private selectedIndex: number = 0;
    private options: ListNavigationOptions<T>;

    constructor(options: ListNavigationOptions<T>) {
        this.options = options;
    }

    public getSelectedIndex(): number {
        return this.selectedIndex;
    }

    public getSelectedId(): string | number | null {
        return this.selectedId;
    }

    public getSelectedItem(): T | null {
        const items = this.options.getItems();
        if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
            return items[this.selectedIndex];
        }
        return null;
    }

    public setSelectedIndex(index: number, notify: boolean = true, autoScroll: boolean = true): void {
        const items = this.options.getItems();
        if (items.length === 0) {
            this.selectedIndex = -1;
            this.selectedId = null;
            this.updateDOMSelection(autoScroll);
            if (notify && this.options.onSelectionChange) {
                this.options.onSelectionChange(null, -1);
            }
            return;
        }

        const newIndex = Math.max(0, Math.min(items.length - 1, index));
        if (newIndex !== this.selectedIndex && newIndex !== -1) {
            SoundService.playFocus();
        }
        this.selectedIndex = newIndex;
        const selected = items[this.selectedIndex];
        this.selectedId = this.options.getItemId(selected);

        this.updateDOMSelection(autoScroll);

        if (notify && this.options.onSelectionChange) {
            this.options.onSelectionChange(selected, this.selectedIndex);
        }
    }

    public setSelectedId(id: string | number | null, fallbackIndex: number = 0): void {
        const items = this.options.getItems();
        if (id === null || items.length === 0) {
            this.setSelectedIndex(fallbackIndex);
            return;
        }

        const foundIndex = items.findIndex(item => this.options.getItemId(item) === id);
        if (foundIndex !== -1) {
            this.setSelectedIndex(foundIndex);
        } else {
            this.setSelectedIndex(fallbackIndex);
        }
    }

    public navigateNext(): void {
        const items = this.options.getItems();
        if (items.length === 0) return;
        const nextIndex = Math.min(items.length - 1, this.selectedIndex + 1);
        this.setSelectedIndex(nextIndex);
    }

    public navigatePrev(): void {
        const items = this.options.getItems();
        if (items.length === 0) return;
        const prevIndex = Math.max(0, this.selectedIndex - 1);
        this.setSelectedIndex(prevIndex);
    }

    public handleKeyDown(e: KeyboardEvent): boolean {
        if (KeybindsSystem.isAction(e, 'NAV_DOWN')) {
            this.navigateNext();
            return true;
        }
        if (KeybindsSystem.isAction(e, 'NAV_UP')) {
            this.navigatePrev();
            return true;
        }
        return false;
    }

    public bindEventDelegation(): void {
        const container = this.options.containerSupplier();
        if (!container) return;

        const selector = this.options.itemSelector || '.sl-item';

        container.onclick = (e: MouseEvent) => {
            e.stopPropagation();
            const target = e.target as HTMLElement;

            if (target.closest('.ql-collapse-btn')) {
                const isCollapsed = container.getAttribute('data-collapsed') === 'true';
                if (isCollapsed) {
                    if (this.options.onItemClick) {
                        this.options.onItemClick(null as any, -1);
                    }
                } else {
                    if (this.options.onItemClick) {
                        this.options.onItemClick(null as any, -2);
                    }
                }
                return;
            }

            const itemEl = target.closest(selector) as HTMLElement;
            if (itemEl && this.options.onItemClick) {
                const items = this.options.getItems();
                const index = Array.from(container.querySelectorAll(selector)).indexOf(itemEl);
                if (index !== -1 && items[index]) {
                    this.options.onItemClick(items[index], index);
                }
            } else if (container.getAttribute('data-collapsed') === 'true' && this.options.onItemClick) {
                this.options.onItemClick(null as any, -1);
            }
        };

        const listEl = container.querySelector('.sl-items-list') as HTMLElement || container;
        
        let lastMouseX = -1;
        let lastMouseY = -1;

        listEl.onmousemove = (e: MouseEvent) => {
            if (lastMouseX === e.clientX && lastMouseY === e.clientY) {
                return;
            }
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            const target = e.target as HTMLElement;
            const itemEl = target.closest(selector) as HTMLElement;
            if (itemEl && this.options.onItemHover) {
                const items = this.options.getItems();
                const index = Array.from(container.querySelectorAll(selector)).indexOf(itemEl);
                if (index !== -1 && items[index]) {
                    this.options.onItemHover(items[index], index);
                }
            }
        };

        listEl.onmouseleave = () => {
            if (this.options.onItemHover) {
                this.options.onItemHover(null, -1);
            }
        };
    }

    public updateDOMSelection(autoScroll: boolean = true): void {
        const container = this.options.containerSupplier();
        if (!container) return;

        const selector = this.options.itemSelector || '.sl-item';
        const items = container.querySelectorAll(selector);

        items.forEach((item, idx) => {
            if (idx === this.selectedIndex) {
                item.classList.add('selected');
                if (autoScroll) {
                    (item as HTMLElement).scrollIntoView({ block: 'nearest' });
                }
            } else {
                item.classList.remove('selected');
            }
        });
    }

    public preserveSelectionOnExpand(targetRelativeOffset: number | null = null): void {
        const items = this.options.getItems();
        if (this.selectedId !== null) {
            const foundIdx = items.findIndex(item => this.options.getItemId(item) === this.selectedId);
            this.selectedIndex = foundIdx !== -1 ? foundIdx : 0;
        } else if (expandedQuestsLength(items)) {
            this.selectedIndex = 0;
            this.selectedId = this.options.getItemId(items[0]);
        } else {
            this.selectedIndex = -1;
            this.selectedId = null;
        }

        if (targetRelativeOffset !== null && this.selectedIndex !== -1) {
            this.scrollItemToRelativeOffset(this.selectedIndex, targetRelativeOffset);
        }
    }

    public scrollItemToRelativeOffset(index: number, targetRelativeOffset: number): void {
        const container = this.options.containerSupplier();
        if (!container) return;

        const listEl = container.querySelector('.sl-items-list') as HTMLElement;
        const selector = this.options.itemSelector || '.sl-item';
        const items = container.querySelectorAll(selector);
        const selectedItem = items[index] as HTMLElement;

        if (listEl && selectedItem) {
            const panelRect = container.getBoundingClientRect();
            const listRect = listEl.getBoundingClientRect();
            const itemRect = selectedItem.getBoundingClientRect();

            const dockCorner = container.getAttribute('data-dock') || 'top-left';
            const isBottomDocked = dockCorner.startsWith('bottom');

            let desiredScrollTop = listEl.scrollTop;
            let maxScrollTop = 0;

            if (isBottomDocked) {
                const currentRelativeBottom = panelRect.bottom - itemRect.bottom;
                const delta = targetRelativeOffset - currentRelativeBottom;
                desiredScrollTop = listEl.scrollTop + delta;
                maxScrollTop = listEl.scrollTop + (itemRect.top - listRect.top);
            } else {
                const currentRelativeTop = itemRect.top - panelRect.top;
                const delta = currentRelativeTop - targetRelativeOffset;
                desiredScrollTop = listEl.scrollTop + delta;
                maxScrollTop = listEl.scrollTop + (itemRect.top - listRect.top);
            }

            const computedListHeight = listEl.clientHeight || listRect.height;
            const minScrollTop = maxScrollTop + itemRect.height - computedListHeight;

            desiredScrollTop = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));
            desiredScrollTop = Math.max(desiredScrollTop, minScrollTop);

            listEl.scrollTop = desiredScrollTop;
            listEl.dispatchEvent(new Event('scroll'));
        }
    }
}

function expandedQuestsLength(items: any[]): boolean {
    return items.length > 0;
}
