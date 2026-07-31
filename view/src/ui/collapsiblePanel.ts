import { DockControlsSystem, DockCorner } from '../systems/dockControls.js';

export interface CollapsiblePanelOptions {
    panelElement: HTMLElement;
    titleElement?: HTMLElement;
    collapseBtnElement?: HTMLElement;
    dockCorner?: DockCorner;
    initiallyCollapsed?: boolean;
    onToggle?: (isCollapsed: boolean) => void;
}

export class CollapsiblePanel {
    private options: CollapsiblePanelOptions;
    private isCollapsed: boolean;
    private dockCorner: DockCorner;

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
    }

    public toggle(): void {
        this.setCollapsed(!this.isCollapsed);
    }

    public setCollapsed(collapsed: boolean): void {
        if (this.isCollapsed === collapsed) return;
        this.isCollapsed = collapsed;
        this.options.panelElement.setAttribute('data-collapsed', String(this.isCollapsed));
        this.updateGlyph();

        if (this.options.onToggle) {
            this.options.onToggle(this.isCollapsed);
        }
    }

    public updateGlyph(): void {
        const icon = this.options.panelElement.querySelector('.ql-btn-icon');
        if (icon) {
            icon.textContent = DockControlsSystem.getGlyph(this.dockCorner, this.isCollapsed);
        }
    }

    public getIsCollapsed(): boolean {
        return this.isCollapsed;
    }
}
