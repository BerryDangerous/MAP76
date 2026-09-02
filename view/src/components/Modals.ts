import { FastTravelStatus } from '@/types/map.js';

import { FAST_TRAVEL_ERROR_MESSAGES } from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';
import { t } from '@/core/i18n.js';

import { ModalManager } from '@/systems/modalManager.js';

export function showFastTravelConfirmationModal(locationName: string, onConfirm: () => void, onCancel?: () => void): void {
    if (!appSettings.confirmFastTravel) {
        onConfirm();
        return;
    }

    ModalManager.show({
        text: t('fastTravel.confirm', { location: locationName, defaultValue: `Fast travel to ${locationName}?` }),
        buttons: [
            {
                label: t('controls.actions.yes', { defaultValue: 'YES' }),
                action: () => {
                    ModalManager.close();
                    onConfirm();
                }
            },
            {
                label: t('controls.actions.no', { defaultValue: 'NO' }),
                action: () => {
                    ModalManager.close();
                    if (onCancel) onCancel();
                }
            }
        ]
    });
}

export function showFastTravelErrorModal(status: FastTravelStatus): void {
    const fallback = FAST_TRAVEL_ERROR_MESSAGES[status] || "Fast travel unavailable at this moment.";
    const message = t(`fastTravel.errors.${status}`, { defaultValue: fallback });
    
    ModalManager.show({
        text: message,
        buttons: [
            {
                label: t('controls.actions.ok', { defaultValue: 'OK' }),
                action: () => {
                    ModalManager.close();
                }
            }
        ]
    });
}

export function showConfirmationModal(
    text: string, 
    onConfirm: () => void, 
    onCancel?: () => void, 
    confirmText: string = 'YES', 
    cancelText: string = 'NO'
): void {
    ModalManager.show({
        text: text,
        buttons: [
            {
                label: t('controls.actions.yes', { defaultValue: confirmText }),
                action: () => {
                    ModalManager.close();
                    onConfirm();
                }
            },
            {
                label: t('controls.actions.no', { defaultValue: cancelText }),
                action: () => {
                    ModalManager.close();
                    if (onCancel) onCancel();
                }
            }
        ]
    });
}
