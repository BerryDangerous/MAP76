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

namespace PaperMap::Engine::QuestManager
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

            // Fallback for ESL / Light plugins (FormIDs starting with 0xFE)
            if (!form && (a_formID & 0xFF000000) == 0xFE000000)
            {
                form = RE::TESForm::GetFormByID(a_formID & Constants::FormID::FORM_ID_INDEX_MASK);
            }

            if (form && form->formType.underlying() == Constants::Quest::FORM_TYPE_ID)
            {
                return static_cast<RE::TESQuest *>(form);
            }

            return nullptr;
        }

        /**
         * @brief Extracts the numerical objective state (Dormant, Active, Completed, Failed)
         *        from a Pip-Boy objective UI object.
         */
        uint32_t ResolveObjectiveState(RE::PipboyObject *a_objUiObj)
        {
            if (GetPipboyBool(a_objUiObj, "completed", false))
            {
                return ObjectiveState::COMPLETED;
            }
            if (GetPipboyBool(a_objUiObj, "failed", false))
            {
                return ObjectiveState::FAILED;
            }
            if (GetPipboyBool(a_objUiObj, "enabled", false))
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

        /**
         * @brief Searches active map markers linked to a quest and extracts their
         *        3D coordinates if they correspond to the active objective.
         */
        std::vector<ObjectiveTargetData> CollectObjectiveTargets(
            uint32_t a_objectiveIndex,
            uint32_t a_questFormID,
            bool a_isMiscSub,
            RE::PipboyDataManager *a_pipboyManager)
        {
            std::vector<ObjectiveTargetData> targetsArray;
            auto &questMap = a_pipboyManager->mapData.worldQuestMarkers;

            for (auto it = questMap.begin(); it != questMap.end(); ++it)
            {
                RE::PipboyObject *markerUiObj = it->second;
                if (!markerUiObj)
                {
                    continue;
                }

                if (!IsMarkerLinkedToQuest(markerUiObj, a_questFormID))
                {
                    continue;
                }

                RE::ObjectRefHandle handle = it->first;
                auto refrPtr = handle ? handle.get() : nullptr;
                auto *refr = refrPtr ? refrPtr.get() : nullptr;

                ObjectiveTargetData targetPin{};
                if (!refr || !Memory::IsRefrPositionSafe(refr, targetPin.position))
                {
                    continue;
                }

                uint32_t markerObjIndex = GetMarkerObjectiveIndex(markerUiObj);

                if (a_isMiscSub || markerObjIndex == UNKNOWN_OBJECTIVE_INDEX || markerObjIndex == a_objectiveIndex)
                {
                    auto *markerWorld = GetReferenceWorldspace(refr, &targetPin.position);

                    targetPin.isDoor = GetPipboyBool(markerUiObj, "OnDoor", false);
                    targetPin.worldspaceFormID = markerWorld ? markerWorld->formID : 0;
                    targetPin.worldspaceEditorID = (markerWorld && markerWorld->GetFormEditorID()) ? markerWorld->GetFormEditorID() : "";

                    targetsArray.push_back(targetPin);
                }
            }

            return targetsArray;
        }

        /**
         * @brief Serializes a single objective object from Pip-Boy data into DTO data.
         */
        ObjectiveData SerializeObjectiveData(
            RE::PipboyObject *a_objUiObj,
            uint32_t a_defaultIndex,
            uint32_t a_questFormID,
            bool a_isMiscSub,
            RE::PipboyDataManager *a_pipboyManager)
        {
            ObjectiveData objNode{};
            objNode.index = GetPipboyUint32(a_objUiObj, "index", GetPipboyUint32(a_objUiObj, "indexID", GetPipboyUint32(a_objUiObj, "Obj", a_defaultIndex)));
            objNode.text = GetPipboyString(a_objUiObj, "text", "");
            objNode.state = ResolveObjectiveState(a_objUiObj);

            if (objNode.state == ObjectiveState::ACTIVE)
            {
                objNode.targets = CollectObjectiveTargets(objNode.index, a_questFormID, a_isMiscSub, a_pipboyManager);
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
                questNode.objectives.push_back(SerializeObjectiveData(questObj, 0, realQuest->formID, true, a_pipboyManager));
            }
            else
            {
                auto *uiObjectivesList = GetPipboyArray(questObj, "objectives");
                if (uiObjectivesList)
                {
                    uint32_t defaultObjIndex = 0;
                    for (auto *subObjectiveVal : uiObjectivesList->elements)
                    {
                        if (subObjectiveVal && subObjectiveVal->GetType() == RE::PipboyValue::kObject)
                        {
                            auto *objUiObj = reinterpret_cast<RE::PipboyObject *>(subObjectiveVal);
                            questNode.objectives.push_back(SerializeObjectiveData(objUiObj, defaultObjIndex++, realQuest->formID, false, a_pipboyManager));
                        }
                    }
                }
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
                        PaperMap::UI::TriggerFreshMapDataSync();
                    }
                }
                else
                {
                    PaperMap::UI::TriggerFreshMapDataSync();
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
            PaperMap::UI::TriggerFreshMapDataSync();
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
