import { EngineBridge } from '@/core/bridge.js';

import { LayoutManager, Corner } from '@/systems/layoutManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';

export interface CollapsiblePanelOptions {
    panelElement: HTMLElement;
    titleElement?: HTMLElement;
    collapseBtnElement?: HTMLElement;
    dockCorner?: Corner;
    initiallyCollapsed?: boolean;
    onToggle?: (isCollapsed: boolean) => void;
}

export class CollapsiblePanel {
    private options: CollapsiblePanelOptions;
    private isCollapsed: boolean;
    private dockCorner: Corner;

    constructor(options: CollapsiblePanelOptions) {
        this.options = options;
        this.isCollapsed = options.initiallyCollapsed ?? false;
        this.dockCorner = options.dockCorner ?? 'top-left';
        this.init();
    }

    private init(): void {
        const { panelElement, collapseBtnElement } = this.options;
        panelElement.setAttribute('data-collapsed', String(this.isCollapsed));
        this.updateGlyph();

        if (collapseBtnElement) {
            collapseBtnElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        window.addEventListener('controlsUpdated', () => {
            this.updateGlyph();
        });
    }

    public toggle(): void {
        this.setCollapsed(!this.isCollapsed);
    }

    public setCollapsed(collapsed: boolean): void {
        if (this.isCollapsed === collapsed) return;
        this.isCollapsed = collapsed;
        
        if (!collapsed) {
            EngineBridge.emitSound('UIMenuOK');
        } else {
            EngineBridge.emitSound('UIMenuCancel');
        }

        this.options.panelElement.setAttribute('data-collapsed', String(this.isCollapsed));
        this.updateGlyph();

        if (this.options.onToggle) {
            this.options.onToggle(this.isCollapsed);
        }
    }

    public updateGlyph(): void {
        const icon = this.options.panelElement.querySelector('.cp-btn-icon');
        if (icon) {
            const config = LayoutManager.getCornerConfig(this.dockCorner);
            const rawGlyph = this.isCollapsed ? config.expandGlyph : config.collapseGlyph;
            icon.textContent = KeybindsSystem.getPanelGlyph(rawGlyph);
        }
    }

    public getIsCollapsed(): boolean {
        return this.isCollapsed;
    }
}
