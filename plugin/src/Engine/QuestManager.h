#pragma once
#include <RE/Fallout.h>
#include <string>
#include <vector>

namespace PaperMap::Engine::QuestManager
{
    struct QuestRecordTarget
    {
        RE::TESQuest *questForm;
        bool liveTrackingState;
        bool isMiscSub;
    };

    /**
     * @brief Holds position and tracking context for an active objective target in the world.
     */
    struct ObjectiveTargetData
    {
        RE::NiPoint3 position;
        bool isDoor;
        uint32_t worldspaceFormID;
        std::string worldspaceEditorID;
    };

    /**
     * @brief Holds dynamic state data for a quest objective.
     */
    struct ObjectiveData
    {
        std::string text;
        uint32_t status;
        std::vector<ObjectiveTargetData> targets;
    };

    /**
     * @brief Holds dynamic state and structural data for a quest.
     */
    struct QuestData
    {
        std::string questName;
        std::string description;
        bool isTracked;
        bool isMisc;
        std::string type;
        std::vector<ObjectiveData> objectives;
    };

    /**
     * @brief Collects all registered quests and their active objectives from the Pip-Boy data manager.
     */
    std::vector<QuestData> CollectAll(RE::PipboyDataManager *a_pipboyManager);

    void ActivateAllUserFacingQuests();
    void ForceQuestActiveViaVM(RE::TESQuest *a_quest);
}
