import { setCustomMarker, removeCustomMarker } from '../core/bridge';

let activeModalElement: HTMLElement | null = null;
let activeOutsideClickListener: ((e: MouseEvent) => void) | null = null;

export function closeCustomMarkerModal(): void {
    if (activeOutsideClickListener) {
        document.removeEventListener('click', activeOutsideClickListener);
        activeOutsideClickListener = null;
    }
    if (activeModalElement) {
        activeModalElement.remove();
        activeModalElement = null;
    }
}

export function showCustomMarkerModal(
    gameCoords: { x: number; y: number },
    pageCoords: { x: number; y: number },
    mapContainer: HTMLElement
): void {
    closeCustomMarkerModal();

    const hasExistingMarker = Boolean(document.querySelector('.custom-marker'));

    const modal = document.createElement('div');
    modal.className = 'custom-marker-modal';
    modal.style.left = `${pageCoords.x}px`;
    modal.style.top = `${pageCoords.y}px`;

    const title = document.createElement('div');
    title.className = 'custom-marker-modal-title';
    title.textContent = hasExistingMarker ? 'Move Custom Marker' : 'Set Custom Marker';

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'custom-marker-modal-actions';

    const confirmButton = document.createElement('button');
    confirmButton.className = 'btn-modal-confirm';
    confirmButton.textContent = hasExistingMarker ? 'Move Marker' : 'Place Marker';
    confirmButton.addEventListener('click', () => {
        setCustomMarker(gameCoords.x, gameCoords.y);
        closeCustomMarkerModal();
    });

    actionsContainer.appendChild(confirmButton);

    if (hasExistingMarker) {
        const removeButton = document.createElement('button');
        removeButton.className = 'btn-modal-remove';
        removeButton.textContent = 'Remove Marker';
        removeButton.addEventListener('click', () => {
            removeCustomMarker();
            closeCustomMarkerModal();
        });
        actionsContainer.appendChild(removeButton);
    }

    const cancelButton = document.createElement('button');
    cancelButton.className = 'btn-modal-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
        closeCustomMarkerModal();
    });
    actionsContainer.appendChild(cancelButton);

    modal.appendChild(title);
    modal.appendChild(actionsContainer);
    
    modal.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
    });

    mapContainer.appendChild(modal);

    activeModalElement = modal;

    activeOutsideClickListener = (e: MouseEvent) => {
        if (activeModalElement && !activeModalElement.contains(e.target as Node)) {
            closeCustomMarkerModal();
        }
    };
    setTimeout(() => {
        if (activeOutsideClickListener) {
            document.addEventListener('click', activeOutsideClickListener);
        }
    }, 50);
}
