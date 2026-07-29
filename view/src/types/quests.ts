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
    targets: QuestTarget[];
}

export interface QuestItem {
    questName: string;
    description: string;
    type:
    "Side" |              // 0
    "Main" |              // 1
    "Brotherhood" |       // 2
    "Institute" |         // 3
    "Minutemen" |         // 4
    "Railroad" |          // 5
    "Misc" |              // 6
    "Side" |              // 7
    "Automatron" |        // 8
    "WastelandWorkshop" | // 9
    "FarHarbor";          // 10
    isMisc: boolean;
    isTracked: boolean;
    objectives: QuestObjective[];
}
