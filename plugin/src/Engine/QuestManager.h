#pragma once
#include <RE/Fallout.h>
#include <string>
#include <vector>

namespace MAP76::Engine::QuestManager
{
    struct QuestRecordTarget
    {
        RE::TESQuest *questForm;
        RE::PipboyObject *pipboyObj;
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
        uint32_t worldspace;
    };

    /**
     * @brief Holds dynamic state data for a quest objective.
     */
    struct ObjectiveData
    {
        uint32_t index;
        std::string text;
        uint32_t state;
        std::vector<ObjectiveTargetData> targets;
    };

    /**
     * @brief Holds dynamic state and structural data for a quest.
     */
    struct QuestData
    {
        uint32_t formId;
        std::string questName;
        std::string journal;
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
    void SetQuestActive(RE::TESQuest *a_quest, bool a_active);
    void ToggleQuestActive(uint32_t a_formId);
    void MakeOnlyQuestActive(uint32_t a_formId);
}
