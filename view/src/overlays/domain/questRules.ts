import { QuestItem } from '@/types/quests.js';

export const QuestUtils = {
    isQuestCompleted(quest: QuestItem): boolean {
        if (!quest.objectives || quest.objectives.length === 0) {
            return false;
        }
        const hasActive = quest.objectives.some(o => o.state === 1);
        const hasCompleted = quest.objectives.some(o => o.state === 2 || o.state === 3);
        return !hasActive && hasCompleted;
    },

    hasActiveTargets(quest: QuestItem): boolean {
        if (!quest.objectives || quest.objectives.length === 0) {
            return false;
        }
        return quest.objectives.some(o => o.state === 1 && o.targets && o.targets.length > 0);
    }
};
