import { FastTravelStatus } from '@/types/map.js';

import { FAST_TRAVEL_ERROR_MESSAGES } from '@/core/constants.js';
import { appSettings } from '@/core/settings.js';

import { ModalManager } from '@/systems/modalManager.js';

export function showFastTravelConfirmationModal(locationName: string, onConfirm: () => void, onCancel?: () => void): void {
    if (!appSettings.confirmFastTravel) {
        onConfirm();
        return;
    }

    ModalManager.show({
        text: `Fast travel to ${locationName}?`,
        buttons: [
            {
                label: 'YES',
                action: () => {
                    ModalManager.close();
                    onConfirm();
                }
            },
            {
                label: 'NO',
                action: () => {
                    ModalManager.close();
                    if (onCancel) onCancel();
                }
            }
        ]
    });
}

export function showFastTravelErrorModal(status: FastTravelStatus): void {
    const message = FAST_TRAVEL_ERROR_MESSAGES[status] || "Fast travel unavailable at this moment.";
    
    ModalManager.show({
        text: message,
        buttons: [
            {
                label: 'OK',
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
                label: confirmText,
                action: () => {
                    ModalManager.close();
                    onConfirm();
                }
            },
            {
                label: cancelText,
                action: () => {
                    ModalManager.close();
                    if (onCancel) onCancel();
                }
            }
        ]
    });
}
