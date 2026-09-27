export interface AppSettings {
    uiScale: number;
    markerSize: number;
    focusMarkerOnSelection: boolean;
    resetViewportOnPanelCollapse: boolean;
    freezeSimulation: boolean;
    confirmFastTravel: boolean;
    skipSurvivalFastTravelCheck: boolean;
    alternativeMapSound: boolean;
    limitQuestPanelHeight: boolean;
    compactPanels: boolean;
    hideInactiveQuestMarkers: boolean;
    centerOnPlayerWhenOpened: boolean;
    writePayloadToFile: boolean;
    showWorkshopInfoLog: boolean;
    gamepadPanSensitivity: number;
    controllerStyle: number;
    preferredMapConfigs: Record<string, string>;
    language: string;
}

export const defaultSettings: AppSettings = {
    uiScale: 1.0,
    markerSize: 1.0,
    focusMarkerOnSelection: false,
    resetViewportOnPanelCollapse: false,
    freezeSimulation: true,
    confirmFastTravel: false,
    skipSurvivalFastTravelCheck: false,
    alternativeMapSound: false,
    limitQuestPanelHeight: false,
    compactPanels: false,
    hideInactiveQuestMarkers: false,
    centerOnPlayerWhenOpened: true,
    writePayloadToFile: false,
    showWorkshopInfoLog: false,
    gamepadPanSensitivity: 0.5,
    controllerStyle: 0,
    preferredMapConfigs: {},
    language: "",
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
    document.documentElement.style.setProperty('--marker-size-mult', appSettings.markerSize.toString());
    
    if (appSettings.compactPanels) {
        document.body.classList.add('compact-panels');
    } else {
        document.body.classList.remove('compact-panels');
    }
    
    const questPanel = document.getElementById('quest-list-panel');
    if (questPanel) {
        if (appSettings.limitQuestPanelHeight) {
            questPanel.classList.add('height-limited');
        } else {
            questPanel.classList.remove('height-limited');
        }
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
