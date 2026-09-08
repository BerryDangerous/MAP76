import { PlayerData } from '@/types/map.js';
import { FrameTickPayload } from '@/types/payloads.js';
import { t } from '@/core/i18n.js';

import { mapState } from '@/core/state.js';

import { FocusManager } from '@/systems/focusManager.js';
import { KeybindsSystem } from '@/systems/keybindManager.js';

import { WorldspaceUtils } from '@/utils/worldspaceUtils.js';

export class InfoBar {
    private static infoContainer: HTMLElement | null = null;
    private static settingsContainer: HTMLElement | null = null;
    
    private static worldspace: string = '';
    private static dateStr: string = '';
    private static timeStr: string = '';

    private static bracketTick: number = 0;
    private static bracketInterval: number | null = null;

    public static init() {
        this.infoContainer = document.getElementById('info-bar');
        this.settingsContainer = document.getElementById('settings-bar');

        if (this.settingsContainer) {
            this.settingsContainer.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">${KeybindsSystem.getControlHtml('OPEN_MENU')}</span>`;
            FocusManager.subscribe((newFocus) => {
                if (this.settingsContainer) {
                    this.settingsContainer.style.display = newFocus === 'MAP' ? '' : 'none';
                }
            });
        }

        window.addEventListener('languageChanged', () => {
            this.reloadLocales();
        });

        window.addEventListener('controlsUpdated', () => {
            if (this.settingsContainer) {
                this.settingsContainer.innerHTML = KeybindsSystem.getControlHtml('OPEN_MENU');
            }
        });
    }

    public static reloadLocales(): void {
        if (this.settingsContainer) {
            this.settingsContainer.innerHTML = `<span style="display: flex; align-items: center; gap: 4px;">${KeybindsSystem.getControlHtml('OPEN_MENU')}</span>`;
        }
    }

    public static initPlayer(player?: PlayerData) {
        if (player && player.worldspace !== undefined) {
            this.updateWorldspace(player.worldspace);
        } else {
            this.renderInfo();
        }
    }

    public static updateWorldspace(wsId: number) {
        this.worldspace = WorldspaceUtils.getWorldspaceName(wsId) || t('info.unknownWorldspace');
        this.renderInfo();
    }

    public static updateTime(tick: FrameTickPayload) {
        const rawHour = tick.hour ?? 0;
        const hours = Math.floor(rawHour);
        const minutes = Math.floor((rawHour % 1) * 60);

        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        this.timeStr = `${hoursStr}:${minutesStr}`;

        const rawMonth = tick.month;
        const monthVal = Math.floor(rawMonth);
        const monthNum = (monthVal >= 1 && monthVal <= 12) ? monthVal : (monthVal + 1);
        const monthStr = String(monthNum).padStart(2, '0');
        const dayStr = String(Math.floor(tick.day)).padStart(2, '0');
        const yearStr = String(Math.floor(tick.year));

        this.dateStr = `${monthStr}.${dayStr}.${yearStr}`;
        
        this.renderInfo();
    }

    private static renderInfo() {
        if (!this.infoContainer) return;
        
        const parts = [];
        if (this.timeStr) parts.push(this.timeStr);
        if (this.dateStr) parts.push(this.dateStr);

        let wsText = this.worldspace ? this.worldspace.toUpperCase() : '';
        
        const currentWsId = mapState.activeMapConfig?.worldspaceID;
        const playerWsId = mapState.lastPayload?.player?.worldspace;
        const isRemote = playerWsId !== undefined && 
                         currentWsId !== undefined && 
                         playerWsId !== currentWsId;

        if (isRemote && wsText) {
            const isFar = (this.bracketTick % 3) === 2;
            const leftBracket = isFar ? "[  " : " [ ";
            const rightBracket = isFar ? "  ]" : " ] ";
            wsText = `<span class="remote-worldspace">${leftBracket}${wsText}${rightBracket}</span>`;

            if (this.bracketInterval === null) {
                this.bracketTick = 0;
                this.bracketInterval = window.setInterval(() => {
                    this.bracketTick++;
                    this.renderInfo();
                }, 500);
            }
        } else {
            if (this.bracketInterval !== null) {
                window.clearInterval(this.bracketInterval);
                this.bracketInterval = null;
            }
        }

        if (wsText) parts.push(wsText);

        this.infoContainer.style.gap = '18px';
        this.infoContainer.innerHTML = parts.map(p => `<b>${p}</b>`).join('');
    }
}
