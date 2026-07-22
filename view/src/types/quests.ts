export interface QuestTarget {
    x: number;
    y: number;
    z: number;
    isDoor: boolean;
    worldspace: number;
    worldspaceEditorID?: string;
}

export interface QuestObjective {
    text: string;
    status: number; // 0=Inactive, 1=Active, 2=Completed, 3=Failed
    index: number;
    targets: QuestTarget[];
}

export interface QuestItem {
    questName: string;
    description: string;
    isTracked: boolean;
    objectives: QuestObjective[];
}
