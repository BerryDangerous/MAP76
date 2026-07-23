import { FastTravelStatus } from '../types/map.js';

const ERROR_MESSAGES: Record<FastTravelStatus, string> = {
    [FastTravelStatus.SUCCESS]: "",
    [FastTravelStatus.PLAYER_DEAD]: "You cannot fast travel while dead.",
    [FastTravelStatus.COMBAT]: "You cannot fast travel while enemies are nearby.",
    [FastTravelStatus.INTERIOR]: "You cannot fast travel from interior locations.",
    [FastTravelStatus.SURVIVAL]: "Fast travel is disabled in Survival Mode.",
    [FastTravelStatus.OVERBURDENED]: "You are carrying too much to fast travel.",
    [FastTravelStatus.QUEST_LOCKED]: "Fast travel is temporarily disabled by active quests.",
    [FastTravelStatus.UNKNOWN_ERROR]: "Fast travel unavailable at this moment."
};

let activeModalOverlay: HTMLElement | null = null;

export function closeFastTravelModal(): void {
    if (activeModalOverlay) {
        activeModalOverlay.remove();
        activeModalOverlay = null;
    }
}

export function showFastTravelConfirmationModal(locationName: string, onConfirm: () => void): void {
    closeFastTravelModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box';

    const text = document.createElement('p');
    text.id = 'modal-text';
    text.textContent = `Fast travel to ${locationName}?`;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'modal-confirm-btn';
    confirmBtn.textContent = 'YES';
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeFastTravelModal();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'modal-cancel-btn';
    cancelBtn.textContent = 'NO';
    cancelBtn.addEventListener('click', () => {
        closeFastTravelModal();
    });

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    modalBox.appendChild(text);
    modalBox.appendChild(actions);
    overlay.appendChild(modalBox);

    document.body.appendChild(overlay);
    activeModalOverlay = overlay;

    const handleOutsideClick = (e: MouseEvent) => {
        if (e.target === overlay) {
            closeFastTravelModal();
        }
    };
    overlay.addEventListener('click', handleOutsideClick);
}

export function showFastTravelErrorModal(status: FastTravelStatus): void {
    closeFastTravelModal();

    const message = ERROR_MESSAGES[status] || "Fast travel unavailable at this moment.";

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';

    const modalBox = document.createElement('div');
    modalBox.className = 'modal-box';

    const text = document.createElement('p');
    text.id = 'modal-text';
    text.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const okBtn = document.createElement('button');
    okBtn.id = 'modal-cancel-btn';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => {
        closeFastTravelModal();
    });

    actions.appendChild(okBtn);
    modalBox.appendChild(text);
    modalBox.appendChild(actions);
    overlay.appendChild(modalBox);

    document.body.appendChild(overlay);
    activeModalOverlay = overlay;
}
