import { EngineBridge } from '@/core/bridge.js';
import { appSettings } from '@/core/settings.js';

export const SoundService = {
    playFocus(): void { EngineBridge.emitSound('UIGeneralFocus'); },
    playAccept(): void { EngineBridge.emitSound('UIMenuOK'); },
    playCancel(): void { EngineBridge.emitSound('UIMenuCancel'); },
    playTabNext(): void { EngineBridge.emitSound('UIPipBoyRotaryVerticalUp'); },
    playTabPrev(): void { EngineBridge.emitSound('UIPipBoyRotaryVerticalDown'); },
    playNavBack(): void { EngineBridge.emitSound('UIMenuCancel'); },

    playMapOpen(): void { EngineBridge.emitSound(appSettings.alternativeMapSound ? 'UIGeneralFocus' : 'UIPerkMenuEnter'); },
    playMapClose(): void { EngineBridge.emitSound(appSettings.alternativeMapSound ? 'UIGeneralFocus' : 'UIPerkMenuExit'); },
    playMapZoom(): void { EngineBridge.emitSound('UIPipBoyMapZoom'); },
    playMapCenter(): void { EngineBridge.emitSound('UIPipBoyMapZoom'); },
    playShowOnMap(): void { EngineBridge.emitSound('UIPipBoyMapZoom'); },
    playMarkerHover(): void { EngineBridge.emitSound('UIPipBoyMapRollover'); },

    playValueChange(): void { EngineBridge.emitSound('UIMenuQuantity'); },
    playQuestActive(): void { EngineBridge.emitSound('UIPipBoyQuestActive'); },
    playQuestInactive(): void { EngineBridge.emitSound('UIPipBoyQuestInactive'); },
};
