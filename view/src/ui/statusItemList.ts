export type ObjectiveState = 1 | 2 | 3 | number;

export interface ObjectiveListItem {
    text: string;
    state: ObjectiveState;
}

export class StatusItemList {
    public static renderObjectives(objectives: ObjectiveListItem[]): string {
        const validObjectives = (objectives || []).filter(o => o.state !== 0);
        if (validObjectives.length === 0) return '';

        return validObjectives.map(obj => {
            let statusClass = 'active';
            let iconText = '';
            if (obj.state === 2) {
                statusClass = 'completed';
                iconText = '✓';
            } else if (obj.state === 3) {
                statusClass = 'failed';
                iconText = '✕';
            }
            return `
                <div class="status-item ${statusClass}">
                    <div class="status-item-text">${this.escapeHtml(obj.text)}</div>
                    ${iconText ? `<div class="status-item-icon">${iconText}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    private static escapeHtml(str: string): string {
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
}
