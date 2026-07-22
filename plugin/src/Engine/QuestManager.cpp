#include "PCH.h"
#include "Engine/QuestManager.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Engine/MapData.h"
#include "Constants.h"

namespace PaperMap::Engine::QuestManager
{
    using namespace PipboyUtils;

    namespace
    {
        /**
         * @brief Resolves whether a Pip-Boy quest object is a standard quest or a
         *        "Miscellaneous" folder containing multiple sub-quests, unwrapping them.
         */
        void ResolveQuestTargets(RE::PipboyObject *a_questObj, std::vector<QuestRecordTarget> &a_outRecords)
        {
            uint32_t questFormID = GetPipboyUint32(a_questObj, "formID", 0);
            bool isTrackedByPlayer = GetPipboyBool(a_questObj, "active", false);
            bool isMiscCategory = (questFormID == 0);

            if (isMiscCategory)
            {
                auto *uiObjectivesList = GetPipboyArray(a_questObj, "objectives");
                if (uiObjectivesList && !uiObjectivesList->elements.empty())
                {
                    for (auto *subObjectiveVal : uiObjectivesList->elements)
                    {
                        if (!subObjectiveVal || subObjectiveVal->GetType() != RE::PipboyValue::kObject)
                        {
                            continue;
                        }

                        auto *subObjObj = reinterpret_cast<RE::PipboyObject *>(subObjectiveVal);
                        uint32_t subQuestFormID = GetPipboyUint32(subObjObj, "formID", 0);
                        bool isSubQuestTracked = GetPipboyBool(subObjObj, "active", false);

                        if (subQuestFormID != 0)
                        {
                            auto *subForm = RE::TESForm::GetFormByID(subQuestFormID);
                            if (subForm && subForm->formType.underlying() == Constants::Quest::FORM_TYPE_ID)
                            {
                                a_outRecords.push_back({static_cast<RE::TESQuest *>(subForm),
                                                        isSubQuestTracked,
                                                        true});
                            }
                        }
                    }
                }
            }
            else
            {
                auto *baseForm = RE::TESForm::GetFormByID(questFormID);
                if (baseForm && baseForm->formType.underlying() == Constants::Quest::FORM_TYPE_ID)
                {
                    a_outRecords.push_back({static_cast<RE::TESQuest *>(baseForm),
                                            isTrackedByPlayer,
                                            false});
                }
            }
        }

        /**
         * @brief Searches active map markers linked to a quest and extracts their
         *        3D coordinates if they correspond to the active objective.
         */
        std::vector<ObjectiveTargetData> CollectObjectiveTargets(
            RE::BGSQuestObjective *a_objective,
            uint32_t a_questFormID,
            RE::PipboyDataManager *a_pipboyManager)
        {
            std::vector<ObjectiveTargetData> targetsArray;
            auto &questMap = a_pipboyManager->mapData.worldQuestMarkers;

            for (auto it = questMap.begin(); it != questMap.end(); ++it)
            {
                RE::ObjectRefHandle handle = it->first;
                if (!handle)
                {
                    continue;
                }

                auto refrPtr = handle.get();
                if (!refrPtr)
                {
                    continue;
                }

                auto *refr = refrPtr.get();
                if (!refr || !Memory::IsReferenceSafe(refr))
                {
                    continue;
                }

                RE::PipboyObject *markerUiObj = it->second;
                if (!markerUiObj)
                {
                    continue;
                }

                uint32_t markerQuestID = GetQuestFormIDFromMarker(markerUiObj);
                const std::string markerObjectiveText = GetPipboyString(markerUiObj, "Name", "");
                
                // Compare lower 24 bits to support remapped ESL FormIDs safely
                const bool isStandardQuestMatch = (a_questFormID != 0) && 
                    ((markerQuestID & Constants::FormID::FORM_ID_INDEX_MASK) == (a_questFormID & Constants::FormID::FORM_ID_INDEX_MASK));
                const bool isMiscQuestCandidate = (a_questFormID == 0) && (markerQuestID != 0);

                if (isStandardQuestMatch || isMiscQuestCandidate)
                {
                    const bool isMatchingObjectiveTarget = (markerObjectiveText == a_objective->displayText.c_str());

                    if (isMatchingObjectiveTarget)
                    {
                        auto *markerWorld = GetReferenceWorldspace(refr);
                        ObjectiveTargetData targetPin{};
                        targetPin.position = refr->GetPosition();
                        targetPin.isDoor = GetPipboyBool(markerUiObj, "OnDoor", false);
                        targetPin.worldspaceFormID = markerWorld ? markerWorld->formID : 0;
                        targetPin.worldspaceEditorID = (markerWorld && markerWorld->GetFormEditorID()) ? markerWorld->GetFormEditorID() : "";

                        targetsArray.push_back(targetPin);
                    }
                }
            }

            return targetsArray;
        }

        /**
         * @brief Formats an individual objective, including its current state and targets.
         */
        ObjectiveData SerializeObjective(
            RE::BGSQuestObjective *a_objective,
            uint32_t a_questFormID,
            RE::PipboyDataManager *a_pipboyManager)
        {
            ObjectiveData objNode{};
            objNode.text = a_objective->displayText.c_str();
            objNode.status = static_cast<uint32_t>(a_objective->state);

            if (objNode.status == Constants::Quest::OBJECTIVE_STATE_ACTIVE)
            {
                objNode.targets = CollectObjectiveTargets(a_objective, a_questFormID, a_pipboyManager);
            }

            return objNode;
        }

        std::string MapQuestType(int32_t a_rawQuestType)
        {
            if (a_rawQuestType >= 1 && a_rawQuestType <= 10)
            {
                return Constants::Quest::TYPE_NAMES[a_rawQuestType];
            }
            return "Side";
        }

        std::string ResolveQuestSummary(RE::TESQuest *a_quest)
        {
            if (a_quest->currentInstanceID != 0)
            {
                RE::BSString formattedSummary;
                RE::BGSQuestInstanceText::ParseString(&formattedSummary, a_quest, a_quest->currentInstanceID);
                if (formattedSummary.c_str())
                {
                    return formattedSummary.c_str();
                }
            }
            return "";
        }

        /**
         * @brief Translates an engine quest record into structural data.
         */
        QuestData SerializeQuest(
            const QuestRecordTarget &a_target,
            uint32_t a_originalQuestFormID,
            RE::PipboyDataManager *a_pipboyManager)
        {
            auto *realQuest = a_target.questForm;
            int32_t rawQuestType = static_cast<int32_t>(realQuest->data.questType);

            std::string questTypeString = MapQuestType(rawQuestType);
            std::string summaryText = ResolveQuestSummary(realQuest);

            QuestData questNode{};
            questNode.questName = RE::TESFullName::GetFullName(*realQuest);
            questNode.description = summaryText;
            questNode.isTracked = a_target.liveTrackingState;
            questNode.isMisc = a_target.isMiscSub;
            questNode.type = questTypeString;

            for (auto *objective : realQuest->objectives)
            {
                if (!objective)
                {
                    continue;
                }
                questNode.objectives.push_back(SerializeObjective(objective, a_originalQuestFormID, a_pipboyManager));
            }

            return questNode;
        }
    }

    std::vector<QuestData> CollectAll(RE::PipboyDataManager *a_pipboyManager)
    {
        std::vector<QuestData> questTreeArray;
        auto &questData = a_pipboyManager->questData;

        if (!questData.questArray || questData.questArray->elements.empty())
        {
            return questTreeArray;
        }

        for (auto *elementValue : questData.questArray->elements)
        {
            if (!elementValue || elementValue->GetType() != RE::PipboyValue::kObject)
            {
                continue;
            }

            auto *questObj = reinterpret_cast<RE::PipboyObject *>(elementValue);
            if (!questObj)
            {
                continue;
            }

            uint32_t originalQuestFormID = GetPipboyUint32(questObj, "formID", 0);

            std::vector<QuestRecordTarget> recordsToProcess;
            ResolveQuestTargets(questObj, recordsToProcess);

            for (const auto &targetRecord : recordsToProcess)
            {
                if (!targetRecord.questForm)
                {
                    continue;
                }
                questTreeArray.push_back(SerializeQuest(targetRecord, originalQuestFormID, a_pipboyManager));
            }
        }

        return questTreeArray;
    }

    void ForceQuestActiveViaVM(RE::TESQuest *a_quest)
    {
        if (!a_quest)
        {
            return;
        }

        auto *gameVM = RE::GameVM::GetSingleton();
        if (!gameVM)
        {
            return;
        }

        auto vmSmartPtr = gameVM->GetVM();
        RE::BSScript::IVirtualMachine *vm = vmSmartPtr ? vmSmartPtr.get() : nullptr;
        if (!vm)
        {
            return;
        }

        const auto &handles = vm->GetObjectHandlePolicy();
        std::size_t questHandle = handles.GetHandleForObject(static_cast<std::uint32_t>(RE::ENUM_FORM_ID::kQUST), a_quest);

        if (questHandle == handles.EmptyHandle())
        {
            return;
        }

        RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> emptyCallback;

        vm->DispatchMethodCall(
            questHandle,
            RE::BSFixedString("Quest"),
            RE::BSFixedString("SetActive"),
            [](RE::BSScrapArray<RE::BSScript::Variable> &a_outArgs)
            {
                RE::BSScript::Variable activeArg;
                RE::BSScript::PackVariable(activeArg, true);
                a_outArgs.push_back(activeArg);
                return true;
            },
            emptyCallback
        );
    }

    void ActivateAllUserFacingQuests()
    {
        auto *dataHandler = RE::TESDataHandler::GetSingleton();
        if (!dataHandler)
        {
            return;
        }

        auto &questArray = dataHandler->GetFormArray<RE::TESQuest>();

        for (auto *quest : questArray)
        {
            if (!quest)
            {
                continue;
            }

            uint32_t flags = quest->data.flags;
            
            uint32_t kEnabled = static_cast<uint32_t>(RE::QuestFlag::kEnabled);
            if ((flags & kEnabled) == 0)
            {
                continue;
            }

            uint32_t kCompleted = static_cast<uint32_t>(RE::QuestFlag::kCompleted);
            uint32_t kFailed = static_cast<uint32_t>(RE::QuestFlag::kFailed);
            if ((flags & kCompleted) != 0 || (flags & kFailed) != 0)
            {
                continue;
            }

            uint32_t kDisplayedInHUD = static_cast<uint32_t>(RE::QuestFlag::kDisplayedInHUD);
            if ((flags & kDisplayedInHUD) == 0)
            {
                continue;
            }

            uint32_t kActive = static_cast<uint32_t>(RE::QuestFlag::kActive);

            if ((flags & kActive) != 0)
            {
                continue;
            }

            ForceQuestActiveViaVM(quest);
        }
    }
}
