import { SettlementData } from '../types/payloads.js';
import { EngineBridge } from '../core/bridge.js';
import { showFastTravelConfirmationModal } from './fastTravelModal.js';
import { PopoverManager } from './popover.js';

export function renderSettlementCardContent(
    containerEl: HTMLElement,
    settlement: SettlementData,
    markerFormId: number,
    canFastTravel: boolean
): void {
    containerEl.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'settlement-card';

    const header = document.createElement('div');
    header.className = 'settlement-card-header';
    header.textContent = settlement.name;
    card.appendChild(header);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'settlement-card-stats-grid';

    const stats = [
        { label: 'Settlers', val: settlement.population },
        { label: 'Happiness', val: `${settlement.happiness}%` },
        { label: 'Food', val: settlement.food },
        { label: 'Water', val: settlement.water },
        { label: 'Power', val: settlement.power },
        { label: 'Defense', val: settlement.defense },
        { label: 'Beds', val: settlement.beds }
    ];

    stats.forEach(stat => {
        const item = document.createElement('div');
        item.textContent = `${stat.label}: ${stat.val}`;
        statsGrid.appendChild(item);
    });

    card.appendChild(statsGrid);

    const btn = document.createElement('button');
    btn.className = 'popover-btn settlement-fast-travel-btn';

    if (canFastTravel) {
        btn.disabled = false;
        btn.classList.add('can-travel');
        btn.innerText = 'FAST TRAVEL';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showFastTravelConfirmationModal(settlement.name, () => {
                EngineBridge.requestFastTravel(markerFormId);
                PopoverManager.closeActivePopover();
            });
        });
    } else {
        btn.disabled = true;
        btn.classList.add('cannot-travel');
        btn.innerText = 'UNDISCOVERED';
    }

    card.appendChild(btn);
    containerEl.appendChild(card);
}
