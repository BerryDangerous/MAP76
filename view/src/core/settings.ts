export interface AppSettings {
    uiScale: number;
    iconTheme: string;
    interfaceTheme: string;
    clampQuestMarkers: boolean;
    focusMarkerOnSelection: boolean;
    resetViewportOnPanelCollapse: boolean;
    freezeSimulation: boolean;
    confirmFastTravel: boolean;
}

export const defaultSettings: AppSettings = {
    uiScale: 1.0,
    iconTheme: 'default',
    interfaceTheme: '76',
    clampQuestMarkers: true,
    focusMarkerOnSelection: false,
    resetViewportOnPanelCollapse: false,
    freezeSimulation: true,
    confirmFastTravel: false,
};

export function getDefaultSettings(): AppSettings {
    return { ...defaultSettings };
}

export const appSettings: AppSettings = { ...defaultSettings };

export function updateSettings(newSettings: Partial<AppSettings>) {
    Object.assign(appSettings, newSettings);
    applySettings();
}

function applySettings() {
    document.documentElement.style.setProperty('--ui-scale', appSettings.uiScale.toString());
    
    if (appSettings.interfaceTheme) {
        document.body.setAttribute('data-theme', appSettings.interfaceTheme);
    } else {
        document.body.removeAttribute('data-theme');
    }
    
    if (appSettings.iconTheme) {
        document.body.setAttribute('data-icon-style', appSettings.iconTheme);
    } else {
        document.body.removeAttribute('data-icon-style');
    }
    
    if (window.saveSettings) {
        window.saveSettings(JSON.stringify(appSettings));
    }
    
    window.dispatchEvent(new Event('settingsUpdated'));
}

(window as any).loadSettings = (jsonString: string) => {
    try {
        if (!jsonString) return;
        const parsed = JSON.parse(jsonString);
        Object.assign(appSettings, defaultSettings, parsed);
        applySettings();
    } catch (e) {
        console.error("Failed to parse settings JSON from C++", e);
    }
};

export function requestSettings() {
    if (window.requestSettings) {
        window.requestSettings();
    }
}
