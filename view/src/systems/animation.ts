import { appSettings } from '@/core/settings.js';
import { mapState } from '@/core/state.js';

export const AnimationEngine = {
    virtualTime: 0,
    intervalId: null as number | null,

    startLoop() {
        if (this.intervalId !== null) return;

        this.intervalId = window.setInterval(() => {
            const targets = mapState.animatedElements;
            if (targets.length === 0) return;

            this.virtualTime += 16;

            const baseSize = Math.max(window.innerWidth, window.innerHeight);
            const mapCurrentSize = baseSize * mapState.zoom;

            const edgePadding = 24;
            const minX = edgePadding;
            const maxX = window.innerWidth - edgePadding;
            const minY = edgePadding;
            const maxY = window.innerHeight - edgePadding;

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const opacity = Math.pow((Math.sin(this.virtualTime * 0.004) + 1) / 2, 1.5);
            let finalOpacity = 0.25 + (opacity * 0.75);

            targets.forEach(el => {
                if (el.classList.contains('marker-container')) {
                    el.querySelectorAll('img').forEach(img => {
                        img.style.opacity = finalOpacity.toString();
                    });
                } else {
                    el.style.opacity = finalOpacity.toString();
                }

                if (el.id === 'player-marker') return;

                const rawPctX = parseFloat(el.dataset.rawPctX || '');
                const rawPctY = parseFloat(el.dataset.rawPctY || '');
                if (isNaN(rawPctX) || isNaN(rawPctY)) return;

                const naturalScreenX = mapState.panX + ((rawPctX / 100) * mapCurrentSize);
                const naturalScreenY = mapState.panY + ((rawPctY / 100) * mapCurrentSize);

                el.style.left = `${rawPctX}%`;
                el.style.top = `${rawPctY}%`;
            });
        }, 16);
    },

    stopLoop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
};
