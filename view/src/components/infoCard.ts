import { PlayerData } from '../types/map.js';
import { FrameTickPayload } from '../types/payloads.js';
import { mapState } from '../core/state.js';
import { WorldspaceUtils } from '../utils/worldspaceUtils.js';

export const InfoCard = {
    init(player?: PlayerData): void {
        const card = document.getElementById('info-card');
        if (!card) return;

        const worldspaceEl = document.getElementById('info-worldspace');
        if (worldspaceEl) {
            let wsName = 'Unknown';
            if (player && player.worldspace !== undefined) {
                wsName = WorldspaceUtils.getWorldspaceName(player.worldspace) || 'Unknown';
            }
            worldspaceEl.textContent = wsName;
        }

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
        const gameTimeEl = document.getElementById('info-game-time');
        if (gameTimeEl) {
            const rawHour = tick.hour ?? 0;
            const hours = Math.floor(rawHour);
            const minutes = Math.floor((rawHour % 1) * 60);

            const hoursStr = String(hours).padStart(2, '0');
            const minutesStr = String(minutes).padStart(2, '0');

            const rawMonth = tick.month;
            const monthVal = Math.floor(rawMonth);
            const monthNum = (monthVal >= 1 && monthVal <= 12) ? monthVal : (monthVal + 1);
            const monthStr = String(monthNum).padStart(2, '0');
            const dayStr = String(Math.floor(tick.day)).padStart(2, '0');
            const yearStr = String(Math.floor(tick.year));

            gameTimeEl.textContent = `${monthStr}.${dayStr}.${yearStr} - ${hoursStr}:${minutesStr}`;
        }

        const realTimeEl = document.getElementById('info-real-time');
        if (realTimeEl) {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            realTimeEl.textContent = `REAL: ${h}:${m}:${s}`;
        }
    }
};
