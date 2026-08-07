export interface QuestTarget {
    x: number;
    y: number;
    z: number;
    isDoor: boolean;
    worldspace: number;
}

export interface QuestObjective {
    index: number;
    text: string;
    state: number; // 0=Inactive, 1=Active, 2=Completed, 3=Failed
    targets: QuestTarget[];
}

export interface QuestItem {
    formId: number;
    questName: string;
    journal: string;
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
