#include "PCH.h"
#include "Engine/QuestManager.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Engine/MapData.h"
#include "UI/Interop.h"
#include "Constants.h"

namespace RE::BSScript
{
    IStackCallbackFunctor::~IStackCallbackFunctor() = default;
}

namespace MAP76::Engine::QuestManager
{
    using namespace PipboyUtils;

    namespace
    {
        namespace ObjectiveState
        {
            constexpr uint32_t DORMANT = 0;
            constexpr uint32_t ACTIVE = 1;
            constexpr uint32_t COMPLETED = 2;
            constexpr uint32_t FAILED = 3;
        }

        constexpr uint32_t UNKNOWN_OBJECTIVE_INDEX = 0xFFFFFFFF;

        /**
         * @brief Safely attempts to resolve a TESQuest form from a FormID,
         *        accounting for Creation Club ESL FormID remapping.
         */
        RE::TESQuest *ResolveQuestForm(uint32_t a_formID)
        {
            if (a_formID == 0)
            {
                return nullptr;
            }

            auto *form = RE::TESForm::GetFormByID(a_formID);

            if (form && form->formType.underlying() == Constants::Quest::FORM_TYPE_ID)
            {
                return static_cast<RE::TESQuest *>(form);
            }

            return nullptr;
        }

        /**
         * @brief Extracts the numerical objective state from a native engine objective state enum.
         */
        uint32_t ResolveObjectiveState(uint32_t a_engineState)
        {
            if (a_engineState == static_cast<uint32_t>(RE::QUEST_OBJECTIVE_STATE::kCompleted) || 
                a_engineState == static_cast<uint32_t>(RE::QUEST_OBJECTIVE_STATE::kCompletedDisplayed))
            {
                return ObjectiveState::COMPLETED;
            }
            if (a_engineState == static_cast<uint32_t>(RE::QUEST_OBJECTIVE_STATE::kFailed) || 
                a_engineState == static_cast<uint32_t>(RE::QUEST_OBJECTIVE_STATE::kFailedDisplayed))
            {
                return ObjectiveState::FAILED;
            }
            if (a_engineState == static_cast<uint32_t>(RE::QUEST_OBJECTIVE_STATE::kDisplayed))
            {
                return ObjectiveState::ACTIVE;
            }
            return ObjectiveState::DORMANT;
        }

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

                        if (auto *subForm = ResolveQuestForm(subQuestFormID))
                        {
                            a_outRecords.push_back({subForm, subObjObj, isSubQuestTracked, true});
                        }
                    }
                }
            }
            else
            {
                if (auto *baseForm = ResolveQuestForm(questFormID))
                {
                    a_outRecords.push_back({baseForm, a_questObj, isTrackedByPlayer, false});
                }
            }
        }

        /**
         * @brief Extracts objective target index from a marker UI object across potential engine keys.
         */
        uint32_t GetMarkerObjectiveIndex(RE::PipboyObject *a_markerUiObj)
        {
            return GetPipboyUint32(a_markerUiObj, "Obj",
                   GetPipboyUint32(a_markerUiObj, "obj",
                   GetPipboyUint32(a_markerUiObj, "index",
                   GetPipboyUint32(a_markerUiObj, "indexID",
                   GetPipboyUint32(a_markerUiObj, "objective", UNKNOWN_OBJECTIVE_INDEX)))));
        }

        struct NativeQuestTarget
        {
            uint64_t unk00;
            uint64_t unk08;
            uint8_t  aliasID;
        };

        int32_t GetQuestAliasIndex(RE::TESQuest* a_questForm, uint8_t a_aliasID)
        {
            for (uint32_t i = 0; i < a_questForm->aliases.size(); ++i)
            {
                auto* aliasPtr = a_questForm->aliases[i];
                if (aliasPtr && aliasPtr->aliasID == a_aliasID)
                {
                    return static_cast<int32_t>(i);
                }
            }
            return -1;
        }

        /**
         * @brief Serializes a single objective object from native engine data into DTO data.
         */
        ObjectiveData SerializeObjectiveData(
            RE::BGSQuestObjective *a_objective,
            RE::TESQuest *a_questForm)
        {
            ObjectiveData objNode{};
            if (!a_objective || !a_questForm)
                return objNode;

            objNode.index = a_objective->index;

            RE::BSString parsedText;
            parsedText.Set(a_objective->displayText.c_str(), 0xFFFF);
            RE::BGSQuestInstanceText::ParseString(&parsedText, a_questForm, a_questForm->currentInstanceID);
            objNode.text = parsedText.c_str() ? parsedText.c_str() : "";

            objNode.state = ResolveObjectiveState(static_cast<uint32_t>(a_objective->state));

            if (objNode.state == ObjectiveState::ACTIVE && a_objective->numTargets > 0 && a_objective->targets)
            {
                auto** targetsArray = reinterpret_cast<NativeQuestTarget**>(a_objective->targets);
                
                for (std::uint32_t t = 0; t < a_objective->numTargets; ++t)
                {
                    NativeQuestTarget* targetData = targetsArray[t];
                    if (reinterpret_cast<uintptr_t>(targetData) < 0x10000) 
                        continue;

                    std::int32_t resolvedAliasIndex = GetQuestAliasIndex(a_questForm, targetData->aliasID);

                    if (resolvedAliasIndex != -1 && resolvedAliasIndex < static_cast<std::int32_t>(a_questForm->aliasedHandles.size()))
                    {
                        const auto& boundReferences = a_questForm->aliasedHandles[resolvedAliasIndex];
                        for (const auto& handle : boundReferences)
                        {
                            if (!handle) 
                                continue;

                            auto refrPtr = handle.get();
                            auto* refr = refrPtr ? refrPtr.get() : nullptr;
                            if (!refr)
                                continue;

                            ObjectiveTargetData target{};
                            if (!Memory::IsRefrPositionSafe(refr, target.position))
                                continue;

                            bool isFallbackDoor = false;
                            auto* targetWorldspace = GetReferenceWorldspace(refr, &target.position, &isFallbackDoor);

                            target.isDoor = (refr->formType == RE::ENUM_FORM_ID::kDOOR) || isFallbackDoor;
                            target.worldspace = targetWorldspace ? targetWorldspace->formID : 0;

                            objNode.targets.push_back(target);
                        }
                    }
                }
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

        void SerializeMiscObjective(RE::PipboyObject* a_questObj, RE::TESQuest* a_realQuest, QuestData& a_outQuestNode)
        {
            uint32_t possibleIndex = GetMarkerObjectiveIndex(a_questObj);
            std::string pipboyText = GetPipboyString(a_questObj, "text", "");

            for (auto* obj : a_realQuest->objectives)
            {
                if (!obj) continue;
                
                if (obj->index == possibleIndex || (!pipboyText.empty() && obj->displayText.c_str() == pipboyText))
                {
                    a_outQuestNode.objectives.push_back(SerializeObjectiveData(obj, a_realQuest));
                    break;
                }
            }
        }

        void SerializeStandardObjectives(RE::TESQuest* a_realQuest, QuestData& a_outQuestNode)
        {
            for (auto* obj : a_realQuest->objectives)
            {
                if (!obj) continue;
                
                if (static_cast<uint32_t>(obj->state) != 0 || !obj->displayText.empty())
                {
                    a_outQuestNode.objectives.push_back(SerializeObjectiveData(obj, a_realQuest));
                }
            }
        }

        /**
         * @brief Translates a Pip-Boy quest UI object into structural data.
         */
        QuestData SerializeQuest(
            const QuestRecordTarget &a_target,
            uint32_t a_originalQuestFormID,
            RE::PipboyDataManager *a_pipboyManager)
        {
            auto *realQuest = a_target.questForm;
            auto *questObj = a_target.pipboyObj;

            int32_t rawQuestType = static_cast<int32_t>(realQuest->data.questType);
            std::string questTypeString = MapQuestType(rawQuestType);

            QuestData questNode{};
            questNode.formId = realQuest->formID;
            questNode.questName = GetPipboyString(questObj, "text", std::string(RE::TESFullName::GetFullName(*realQuest)));
            if (questNode.questName.empty())
            {
                questNode.questName = RE::TESFullName::GetFullName(*realQuest);
            }
            questNode.journal = GetPipboyString(questObj, "desc", "");
            questNode.isTracked = a_target.liveTrackingState;
            questNode.isMisc = a_target.isMiscSub;
            questNode.type = questTypeString;

            if (a_target.isMiscSub)
            {
                SerializeMiscObjective(questObj, realQuest, questNode);
            }
            else
            {
                SerializeStandardObjectives(realQuest, questNode);
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

    namespace
    {
        class QuestActiveCallback : public RE::BSScript::IStackCallbackFunctor
        {
        public:
            explicit QuestActiveCallback(std::shared_ptr<std::atomic<uint32_t>> a_counter = nullptr)
                : _counter(std::move(a_counter))
            {}

            virtual void CallQueued() override {}
            virtual void CallCanceled() override {}
            virtual void StartMultiDispatch() override {}
            virtual void EndMultiDispatch() override {}
            virtual void operator()(RE::BSScript::Variable) override
            {
                if (_counter)
                {
                    if (_counter->fetch_sub(1) == 1)
                    {
                        MAP76::UI::TriggerFreshMapDataSync();
                    }
                }
                else
                {
                    MAP76::UI::TriggerFreshMapDataSync();
                }
            }
            virtual bool CanSave() override { return false; }

        private:
            std::shared_ptr<std::atomic<uint32_t>> _counter;
        };
    }

    void SetQuestActiveViaVM(RE::TESQuest *a_quest, bool a_active, RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> a_callback)
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

        RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> callback = a_callback;
        if (!callback)
        {
            callback = RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor>(new QuestActiveCallback());
        }

        vm->DispatchMethodCall(
            questHandle,
            RE::BSFixedString("Quest"),
            RE::BSFixedString("SetActive"),
            [a_active](RE::BSScrapArray<RE::BSScript::Variable> &a_outArgs)
            {
                RE::BSScript::Variable activeArg;
                RE::BSScript::PackVariable(activeArg, a_active);
                a_outArgs.push_back(activeArg);
                return true;
            },
            callback
        );
    }

    void ToggleQuestActive(uint32_t a_formId)
    {
        auto *quest = RE::TESForm::GetFormByID<RE::TESQuest>(a_formId);
        if (!quest)
        {
            return;
        }

        uint32_t flags = quest->data.flags;
        uint32_t kActive = static_cast<uint32_t>(RE::QuestFlag::kActive);
        bool currentlyActive = (flags & kActive) != 0;

        SetQuestActiveViaVM(quest, !currentlyActive);
    }

    void MakeOnlyQuestActive(uint32_t a_formId)
    {
        auto *targetQuest = RE::TESForm::GetFormByID<RE::TESQuest>(a_formId);
        if (!targetQuest)
        {
            return;
        }

        auto *dataHandler = RE::TESDataHandler::GetSingleton();
        if (!dataHandler)
        {
            return;
        }

        auto &questArray = dataHandler->GetFormArray<RE::TESQuest>();
        uint32_t kEnabled = static_cast<uint32_t>(RE::QuestFlag::kEnabled);
        uint32_t kCompleted = static_cast<uint32_t>(RE::QuestFlag::kCompleted);
        uint32_t kFailed = static_cast<uint32_t>(RE::QuestFlag::kFailed);
        uint32_t kActive = static_cast<uint32_t>(RE::QuestFlag::kActive);

        std::vector<RE::TESQuest *> questsToActivate;
        std::vector<RE::TESQuest *> questsToDeactivate;

        for (auto *quest : questArray)
        {
            if (!quest)
            {
                continue;
            }

            uint32_t flags = quest->data.flags;
            if ((flags & kEnabled) == 0 || (flags & kCompleted) != 0 || (flags & kFailed) != 0)
            {
                continue;
            }

            if (quest->formID == a_formId)
            {
                if ((flags & kActive) == 0)
                {
                    questsToActivate.push_back(quest);
                }
            }
            else if ((flags & kActive) != 0)
            {
                questsToDeactivate.push_back(quest);
            }
        }

        uint32_t totalOps = static_cast<uint32_t>(questsToActivate.size() + questsToDeactivate.size());
        if (totalOps == 0)
        {
            MAP76::UI::TriggerFreshMapDataSync();
            return;
        }

        auto counter = std::make_shared<std::atomic<uint32_t>>(totalOps);

        for (auto *q : questsToDeactivate)
        {
            RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> cb(new QuestActiveCallback(counter));
            SetQuestActiveViaVM(q, false, cb);
        }

        for (auto *q : questsToActivate)
        {
            RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> cb(new QuestActiveCallback(counter));
            SetQuestActiveViaVM(q, true, cb);
        }
    }
}
