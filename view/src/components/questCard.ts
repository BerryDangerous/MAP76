import { QuestItem } from '../types/quests.js';
import { FocusManager } from '../systems/focusManager.js';
import { QuestList } from './questList.js';

export const QuestCard = {
    activeQuest: null as QuestItem | null,
    activeAnchorMarker: null as HTMLElement | null,
    selectedButtonIndex: 0,
    buttonCount: 3,

    init(): void {
        FocusManager.register({
            id: 'QUEST_CARD',
            handleKeyDown: (e: KeyboardEvent) => this.handleKeyDown(e),
            onFocusGained: () => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.add('focused');
                this.selectedButtonIndex = 0;
                this.updateButtonSelection();
            },
            onFocusLost: () => {
                const card = document.getElementById('quest-card-panel');
                if (card) card.classList.remove('focused');
                this.updateButtonSelection();
            }
        });
    },

    handleKeyDown(e: KeyboardEvent): boolean {
        if (e.key === 'ArrowLeft') {
            if (!QuestList.getState().isCollapsed) {
                console.log('[QuestCard] ArrowLeft pressed. Transferring focus to QUEST_LIST.');
                FocusManager.setFocus('QUEST_LIST');
            }
            return true;
        }

        if (e.key === 'ArrowDown') {
            this.selectedButtonIndex = Math.min(this.buttonCount - 1, this.selectedButtonIndex + 1);
            this.updateButtonSelection();
            return true;
        }

        if (e.key === 'ArrowUp') {
            this.selectedButtonIndex = Math.max(0, this.selectedButtonIndex - 1);
            this.updateButtonSelection();
            return true;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            this.triggerButtonAction(this.selectedButtonIndex);
            return true;
        }

        return true;
    },

    triggerButtonAction(index: number): void {
        const btnLabels = ["TOGGLE ACTIVE", "MAKE ONLY THIS ACTIVE", "SHOW IN PIP-BOY"];
        console.log(`[QuestCard] Triggered action for button ${index}: "${btnLabels[index]}" for quest "${this.activeQuest?.questName}"`);
    },

    open(quest: QuestItem, anchorMarker?: HTMLElement): void {
        if (this.activeAnchorMarker && this.activeAnchorMarker !== anchorMarker) {
            this.activeAnchorMarker.classList.remove('is-hovered');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
        }

        this.activeQuest = quest;
        this.activeAnchorMarker = anchorMarker || null;

        let card = document.getElementById('quest-card-panel');
        if (!card) {
            card = document.createElement('div');
            card.id = 'quest-card-panel';
            document.body.appendChild(card);
        }

        if (anchorMarker) {
            card.setAttribute('data-anchored', 'true');
            anchorMarker.classList.add('is-hovered');
            anchorMarker.classList.add('hide-tooltip-override');
        } else {
            card.removeAttribute('data-anchored');
            card.style.left = '';
            card.style.top = '';
        }

        card.style.display = 'flex';
        this.render();

        if (anchorMarker) {
            this.positionNearMarker(anchorMarker);
        }
    },

    positionNearMarker(marker: HTMLElement): void {
        const card = document.getElementById('quest-card-panel');
        if (!card || !marker) return;

        const imgEl = marker.querySelector('img');
        const mRect = imgEl ? imgEl.getBoundingClientRect() : marker.getBoundingClientRect();

        const pWidth = card.offsetWidth || 380;
        const pHeight = card.offsetHeight || 420;
        const gap = 20;

        const markerCenterX = mRect.left + (mRect.width / 2);
        const markerCenterY = mRect.top + (mRect.height / 2);

        const options = [
            { left: mRect.right + gap, top: markerCenterY - (pHeight / 2) },
            { left: mRect.left - pWidth - gap, top: markerCenterY - (pHeight / 2) },
            { left: markerCenterX - (pWidth / 2), top: mRect.top - pHeight - gap },
            { left: markerCenterX - (pWidth / 2), top: mRect.bottom + gap }
        ];

        let chosenCoordinates = options[0];
        let foundUnclipped = false;

        for (const pos of options) {
            if (
                pos.left >= 0 &&
                pos.top >= 0 &&
                pos.left + pWidth <= window.innerWidth &&
                pos.top + pHeight <= window.innerHeight
            ) {
                chosenCoordinates = pos;
                foundUnclipped = true;
                break;
            }
        }

        let clampedLeft = chosenCoordinates.left;
        let clampedTop = chosenCoordinates.top;

        const padding = 10;
        clampedLeft = Math.max(padding, Math.min(window.innerWidth - pWidth - padding, clampedLeft));
        clampedTop = Math.max(padding, Math.min(window.innerHeight - pHeight - padding, clampedTop));

        card.style.left = `${clampedLeft}px`;
        card.style.top = `${clampedTop}px`;
    },

    isOpen(): boolean {
        const card = document.getElementById('quest-card-panel');
        return !!card && card.style.display !== 'none';
    },

    close(): void {
        if (this.activeAnchorMarker) {
            this.activeAnchorMarker.classList.remove('is-hovered');
            this.activeAnchorMarker.classList.remove('hide-tooltip-override');
            this.activeAnchorMarker = null;
        }

        const card = document.getElementById('quest-card-panel');
        if (card) {
            card.style.display = 'none';
            card.removeAttribute('data-anchored');
        }

        if (FocusManager.getFocus() === 'QUEST_CARD') {
            FocusManager.setFocus('MAP');
        }
    },

    updateButtonSelection(): void {
        const card = document.getElementById('quest-card-panel');
        if (!card) return;

        const isCardFocused = FocusManager.getFocus() === 'QUEST_CARD';
        const buttons = card.querySelectorAll('.qc-action-btn');

        buttons.forEach((btn, idx) => {
            if (isCardFocused && idx === this.selectedButtonIndex) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    },

    render(): void {
        const card = document.getElementById('quest-card-panel');
        if (!card || !this.activeQuest) return;

        const quest = this.activeQuest;
        const descriptionText = quest.description && quest.description.trim().length > 0 
            ? quest.description 
            : "No detailed description available for this entry.";
        
        const journalText = "Investigated area coordinates. Checked local records and broadcast signals.";

        const validObjectives = (quest.objectives || []).filter(o => o.status !== 0);

        const objectivesHtml = validObjectives.length > 0 ? validObjectives.map(obj => {
            let statusClass = 'active';
            let iconText = '';
            if (obj.status === 2) {
                statusClass = 'completed';
                iconText = '✓';
            } else if (obj.status === 3) {
                statusClass = 'failed';
                iconText = '✕';
            }
            return `
              <div class="qc-objective-item ${statusClass}">
                 <div class="qc-obj-text">${this.escapeHtml(obj.text)}</div>
                 ${iconText ? `<div class="qc-obj-icon">${iconText}</div>` : ''}
              </div>
            `;
        }).join('') : '<div class="qc-objective-item active"><div class="qc-obj-text">No active objectives listed</div></div>';

        const isCompleted = quest.objectives && quest.objectives.length > 0 && quest.objectives.every(o => o.status === 2 || o.status === 3);
        this.buttonCount = isCompleted ? 1 : 3;

        let buttonsHtml = '';
        if (isCompleted) {
            buttonsHtml = `
             <div class="qc-action-btn" data-btn-index="0">
               <span class="qc-btn-text">SHOW IN PIP-BOY</span>
            </div>`;
        } else {
            buttonsHtml = `
             <div class="qc-action-btn" data-btn-index="0">
               <span class="qc-btn-text">TOGGLE ACTIVE</span>
            </div>
             <div class="qc-action-btn" data-btn-index="1">
               <span class="qc-btn-text">MAKE ONLY THIS ACTIVE</span>
            </div>
             <div class="qc-action-btn" data-btn-index="2">
               <span class="qc-btn-text">SHOW IN PIP-BOY</span>
            </div>`;
        }

        card.innerHTML = `
          <div class="qc-header">
             <div class="qc-title">${this.escapeHtml(quest.questName)}</div>
          </div>
          <div class="qc-body">
             <!-- Quest Description Section -->
             <div class="qc-section">
                <div class="qc-section-box">
                  <div class="qc-section-title">QUEST DESCRIPTION</div>
                  <div class="qc-section-text">${this.escapeHtml(descriptionText)}</div>
               </div>
             </div>

             <!-- Journal Section -->
             <div class="qc-section">
                <div class="qc-section-box">
                  <div class="qc-section-title">JOURNAL</div>
                  <div class="qc-section-text">${this.escapeHtml(journalText)}</div>
               </div>
             </div>

             <!-- Objectives Section -->
             <div class="qc-section">
                <div class="qc-section-box">
                  <div class="qc-section-title">OBJECTIVES</div>
                  <div class="qc-objectives-list">
                    ${objectivesHtml}
                 </div>
               </div>
             </div>
          </div>

          <!-- Bottom Actions Bar -->
          <div class="qc-bottom-bar-container">
             <div class="qc-bottom-bar">
                ${buttonsHtml}
             </div>
          </div>
        `;

        const objListEl = card.querySelector('.qc-objectives-list') as HTMLElement;
        if (objListEl) {
            objListEl.scrollTop = objListEl.scrollHeight;
        }

        const bottomBar = card.querySelector('.qc-bottom-bar');
        if (bottomBar) {
            bottomBar.addEventListener('mouseover', (e: Event) => {
                const btnEl = (e.target as HTMLElement).closest('[data-btn-index]') as HTMLElement;
                if (btnEl) {
                    const idx = parseInt(btnEl.getAttribute('data-btn-index') || '0', 10);
                    if (this.selectedButtonIndex !== idx) {
                        this.selectedButtonIndex = idx;
                        this.updateButtonSelection();
                    }
                }
            });

            bottomBar.addEventListener('click', (e: Event) => {
                const btnEl = (e.target as HTMLElement).closest('[data-btn-index]') as HTMLElement;
                if (btnEl) {
                    const idx = parseInt(btnEl.getAttribute('data-btn-index') || '0', 10);
                    this.triggerButtonAction(idx);
                }
            });
        }

        this.updateButtonSelection();
    },

    escapeHtml(str: string): string {
        return str.replace(/[&<>"']/g, (m) => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }
};
