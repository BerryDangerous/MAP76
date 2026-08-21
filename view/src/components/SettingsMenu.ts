import { EngineBridge } from '@/core/bridge.js';
import { appSettings, updateSettings, getDefaultSettings, AppSettings } from '@/core/settings.js';

import { FocusManager, FocusOwner } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';

import { showConfirmationModal } from '@/components/Modals.js';

import { MultiChoice } from '@/components/ui/SettingsMultiChoice.js';
import { SettingsRow, SettingsControl } from '@/components/ui/SettingsRow.js';
import { Slider } from '@/components/ui/SettingsSlider.js';
import { Toggle } from '@/components/ui/SettingsToggle.js';

interface SettingControlEntry {
    key: keyof AppSettings;
    label: string;
    tab: 'DISPLAY' | 'GAMEPLAY';
    updateUI: (val: any) => void;
    row: SettingsRow;
}

export const SettingsMenu = {
    isOpen: false,
    container: null as HTMLElement | null,
    backdrop: null as HTMLElement | null,
    controls: [] as SettingControlEntry[],
    previousFocus: null as FocusOwner | null,
    
    tabsContainer: null as HTMLElement | null,
    listContainer: null as HTMLElement | null,
    activeTab: 'DISPLAY' as 'DISPLAY' | 'GAMEPLAY',
    pendingCloseKey: null as string | null,

    init() {
        this.container = document.createElement('div');
        this.container.id = 'settings-menu-panel';
        this.container.className = 'panel-hidden';

        this.backdrop = document.createElement('div');
        this.backdrop.id = 'settings-backdrop';
        this.backdrop.className = 'panel-hidden';
        this.backdrop.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleCloseRequest();
        });

        const body = document.createElement('div');
        body.className = 'settings-body';

        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'settings-tabs';
        
        this.listContainer = document.createElement('div');
        this.listContainer.className = 'settings-list';

        body.appendChild(this.tabsContainer);
        body.appendChild(this.listContainer);
        this.container.appendChild(body);

        const registerControl = <K extends keyof AppSettings>(
            key: K, 
            label: string, 
            tab: 'DISPLAY' | 'GAMEPLAY',
            control: SettingsControl
        ) => {
            const row = new SettingsRow(label, control);
            const rowEl = row.getElement();
            
            rowEl.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = rowEl.nextElementSibling as HTMLElement;
                    if (next) next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = rowEl.previousElementSibling as HTMLElement;
                    if (prev) prev.focus();
                }
            });

            this.controls.push({ key, label, tab, updateUI: (val: any) => control.setValue(val), row });
        };

        const uiScaleOptions = [];
        for (let i = 50; i <= 200; i += 10) {
            uiScaleOptions.push({ label: `${i}%`, value: i / 100 });
        }
        const scaleMulti = new MultiChoice(uiScaleOptions, appSettings.uiScale, (val) => { updateSettings({ uiScale: val }); });
        registerControl('uiScale', 'Interface Scale', 'DISPLAY', scaleMulti);
        
        const hideInactiveQuestToggle = new Toggle(appSettings.hideInactiveQuestMarkers, (val) => { updateSettings({ hideInactiveQuestMarkers: val }); });
        registerControl('hideInactiveQuestMarkers', 'Hide Inactive Quest Markers', 'DISPLAY', hideInactiveQuestToggle);
        
        const focusToggle = new Toggle(appSettings.focusMarkerOnSelection, (val) => { updateSettings({ focusMarkerOnSelection: val }); });
        registerControl('focusMarkerOnSelection', 'Auto-Center Markers on List Selection', 'DISPLAY', focusToggle);

        const resetViewportToggle = new Toggle(appSettings.resetViewportOnPanelCollapse, (val) => { updateSettings({ resetViewportOnPanelCollapse: val }); });
        registerControl('resetViewportOnPanelCollapse', 'Restore Map Position When Panel is Closed', 'DISPLAY', resetViewportToggle);

        const limitQuestToggle = new Toggle(appSettings.limitQuestPanelHeight, (val) => { updateSettings({ limitQuestPanelHeight: val }); });
        registerControl('limitQuestPanelHeight', 'Limit Quest Panel Height', 'DISPLAY', limitQuestToggle);

        const altSoundToggle = new Toggle(appSettings.alternativeMapSound, (val) => { updateSettings({ alternativeMapSound: val }); });
        registerControl('alternativeMapSound', 'Alternative Map Change Sound', 'DISPLAY', altSoundToggle);

        const dummySlider = new Slider(50, 0, 100, 1, () => { /* dummy */ });
        registerControl('dummySlider' as any, 'Dummy Slider', 'DISPLAY', dummySlider);

        const freezeToggle = new Toggle(appSettings.freezeSimulation, (val) => { updateSettings({ freezeSimulation: val }); });
        registerControl('freezeSimulation', 'Pause Game While in Map', 'GAMEPLAY', freezeToggle);

        const ftToggle = new Toggle(appSettings.confirmFastTravel, (val) => { updateSettings({ confirmFastTravel: val }); });
        registerControl('confirmFastTravel', 'Fast Travel Confirmation', 'GAMEPLAY', ftToggle);

        this.buildTabs();

        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.container);

        FocusManager.register({
            id: 'SETTINGS_MENU',
            getAvailableControls: () => ['NAV_BACK', 'RESET_DEFAULTS'] as import('../systems/focusManager.js').ControlActionDef[],
            handleKeyDown: (e) => {
                if (e.key === 'Escape' || KeybindsSystem.isAction(e, 'NAV_BACK') || KeybindsSystem.isAction(e, 'CLOSE_MAP')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.pendingCloseKey = e.key || e.code || String(e.keyCode);
                    return true;
                }
                if (e.key === 't' || e.key === 'T') {
                    showConfirmationModal("Restore default settings?\nThis cannot be undone.", () => {
                        updateSettings(getDefaultSettings());
                        this.updateUIFromSettings();
                    }, undefined, "RESTORE", "CANCEL");
                    return true;
                }
                return false;
            },
            handleKeyUp: (e) => {
                const currentKey = e.key || e.code || String(e.keyCode);
                if (this.pendingCloseKey === currentKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.pendingCloseKey = null;
                    this.handleCloseRequest();
                    return true;
                }
                this.pendingCloseKey = null;
                return false;
            }
        });
        
        this.listContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                this.focusActiveTab();
            }
        });
    },

    buildTabs() {
        if (!this.tabsContainer) return;
        this.tabsContainer.innerHTML = '';
        
        const tabs: ('DISPLAY' | 'GAMEPLAY')[] = ['DISPLAY', 'GAMEPLAY'];
        
        tabs.forEach(tabName => {
            const tabEl = document.createElement('div');
            tabEl.className = 'settings-tab';
            tabEl.textContent = tabName;
            tabEl.tabIndex = 0;
            
            if (tabName === this.activeTab) {
                tabEl.classList.add('active');
            }

            tabEl.addEventListener('click', () => {
                this.switchTab(tabName);
                tabEl.focus();
            });

            tabEl.addEventListener('focus', () => {
                EngineBridge.emitSound('UIGeneralFocus');
                this.switchTab(tabName);
            });

            tabEl.addEventListener('mouseenter', () => {
                tabEl.focus();
            });

            tabEl.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = tabEl.nextElementSibling as HTMLElement;
                    if (next) next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = tabEl.previousElementSibling as HTMLElement;
                    if (prev) prev.focus();
                } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.focusFirstItemInList();
                }
            });

            this.tabsContainer!.appendChild(tabEl);
        });
        
        this.renderList();
    },

    switchTab(tab: 'DISPLAY' | 'GAMEPLAY') {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        
        if (this.tabsContainer) {
            Array.from(this.tabsContainer.children).forEach(child => {
                if (child.textContent === tab) {
                    child.classList.add('active');
                } else {
                    child.classList.remove('active');
                }
            });
        }
        
        this.renderList();
    },

    renderList() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        
        const activeControls = this.controls.filter(c => c.tab === this.activeTab);
        activeControls.forEach(c => {
            this.listContainer!.appendChild(c.row.getElement());
        });
    },

    focusActiveTab() {
        if (!this.tabsContainer) return;
        const active = Array.from(this.tabsContainer.children).find(c => c.classList.contains('active')) as HTMLElement;
        if (active) {
            active.focus();
        } else {
            (this.tabsContainer.firstElementChild as HTMLElement)?.focus();
        }
    },

    focusFirstItemInList() {
        if (!this.listContainer) return;
        const first = this.listContainer.firstElementChild as HTMLElement;
        if (first) {
            first.focus();
        }
    },

    open() {
        if (this.isOpen) return;
        if (!this.container) this.init();

        this.updateUIFromSettings();

        this.container!.classList.remove('panel-hidden');
        this.backdrop!.classList.remove('panel-hidden');
        document.body.classList.add('settings-open');
        this.isOpen = true;

        this.previousFocus = FocusManager.getFocus();
        FocusManager.setFocus('SETTINGS_MENU');
        this.focusActiveTab();
    },

    close() {
        if (!this.isOpen) return;
        this.container!.classList.add('panel-hidden');
        this.backdrop!.classList.add('panel-hidden');
        document.body.classList.remove('settings-open');
        this.isOpen = false;
        
        if (this.previousFocus) {
            FocusManager.setFocus(this.previousFocus);
        }
    },

    forceClose() {
        this.close();
    },

    toggle() {
        if (this.isOpen) {
            this.handleCloseRequest();
        } else {
            this.open();
        }
    },

    handleCloseRequest() {
        this.close();
    },

    updateUIFromSettings() {
        this.controls.forEach(c => {
            const val = appSettings[c.key];
            c.updateUI(val);
        });
    }
};
