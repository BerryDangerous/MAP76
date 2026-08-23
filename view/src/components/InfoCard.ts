import { PlayerData } from '@/types/map.js';
import { FrameTickPayload } from '@/types/payloads.js';
import { LayoutManager } from '@/systems/layoutManager.js';

export const InfoCard = {
    init(player?: PlayerData): void {
        const card = document.getElementById('info-card');
        if (!card) return;

        if (card.children.length === 0) {
            card.innerHTML = `
                <div class="info-row">
                    <img src="assets/icons/info-weight.svg" id="icon-weight" class="info-icon" />
                    <span class="info-value" id="info-weight">0/0</span>
                </div>
                <div class="info-row">
                    <img src="assets/icons/info-caps.svg" class="info-icon" />
                    <span class="info-value" id="info-caps">0</span>
                </div>
            `;
            LayoutManager.anchorToCorner(card, 'bottom-right', { bottom: 50, right: 20 });
        }

        const capsEl = document.getElementById('info-caps');
        if (capsEl) {
            capsEl.textContent = `${Math.floor(player?.caps ?? 0)}`;
        }

        const weightEl = document.getElementById('info-weight');
        const iconWeight = document.getElementById('icon-weight') as HTMLImageElement;
        if (weightEl) {
            const current = Math.floor(player?.currentWeight ?? 0);
            const max = Math.floor(player?.maxWeight ?? 0);
            weightEl.textContent = `${current}/${max}`;

            if (current >= max && max > 0) {
                weightEl.classList.add('overburdened');
                if (iconWeight) iconWeight.src = 'assets/icons/info-weight-over.svg';
            } else {
                weightEl.classList.remove('overburdened');
                if (iconWeight) iconWeight.src = 'assets/icons/info-weight.svg';
            }
        }
    },

    update(tick: FrameTickPayload): void {
        if (tick.player) {
            this.init(tick.player);
        }
    }
};
