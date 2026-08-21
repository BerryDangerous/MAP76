import { PlayerData } from '@/types/map.js';
import { FrameTickPayload } from '@/types/payloads.js';

export const InfoCard = {
    init(player?: PlayerData): void {
        const card = document.getElementById('info-card');
        if (!card) return;

        const capsEl = document.getElementById('info-caps');
        if (capsEl) {
            capsEl.textContent = `${Math.floor(player?.caps ?? 0)}`;
        }

        const weightEl = document.getElementById('info-weight');
        if (weightEl) {
            const current = Math.floor(player?.currentWeight ?? 0);
            const max = Math.floor(player?.maxWeight ?? 0);
            weightEl.textContent = `${current}/${max}`;

            if (current >= max && max > 0) {
                weightEl.classList.add('overburdened');
            } else {
                weightEl.classList.remove('overburdened');
            }
        }
    },

    update(tick: FrameTickPayload): void {
        const realTimeEl = document.getElementById('info-real-time');
        if (realTimeEl) {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            realTimeEl.textContent = `REAL: ${h}:${m}:${s}`;
        }
        
        if (tick.player) {
            this.init(tick.player);
        }
    }
};
