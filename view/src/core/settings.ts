export interface AppSettings {
    uiScale: number;
    focusMarkerOnSelection: boolean;
    resetViewportOnPanelCollapse: boolean;
    freezeSimulation: boolean;
    confirmFastTravel: boolean;
    alternativeMapSound: boolean;
}

export const defaultSettings: AppSettings = {
    uiScale: 1.0,
    focusMarkerOnSelection: false,
    resetViewportOnPanelCollapse: false,
    freezeSimulation: true,
    confirmFastTravel: false,
    alternativeMapSound: false,
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
