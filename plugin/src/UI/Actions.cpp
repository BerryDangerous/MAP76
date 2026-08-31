#include <nlohmann/json.hpp>
#include "PCH.h"
#include "UI/Actions.h"
#include "UI/Interop.h"
#include "Engine/MapData.h"
#include "Engine/QuestManager.h"
#include "Constants.h"
#include "RE/N/NEW_REFR_DATA.h"
#include "RE/T/TESDataHandler.h"
#include "RE/T/TESGlobal.h"
#include "RE/B/BGSListForm.h"
#include "RE/B/BSInputEnableManager.h"
#include "RE/B/BSSpinLock.h"
#include "RE/O/OtherInputEvents.h"
#include "RE/P/ProcessLists.h"
#include "RE/B/BSTArray.h"

namespace MAP76::UI::Actions
{
    namespace
    {
        /**
         * @brief Wrapper to queue fast travel, bypassing a CommonLibF4 compiler ABI mismatch.
         *
         * @details In CommonLibF4, the `PlayerCharacter::QueueFastTravel` signature passes the
         * `ObjectRefHandle` parameter by value. However, because `ObjectRefHandle` contains
         * non-trivial constructors/destructors, MSVC's x64 ABI mandates that it be passed by reference
         * (via a pointer in the RDX register).
         *
         * Calling the header's by-value signature forces the compiler to pass the raw handle ID
         * directly in the register. The engine then misinterprets this ID as a memory pointer,
         * leading to a silent failure.
         *
         * This helper overrides the calling signature to force pass-by-reference (`const RE::ObjectRefHandle&`),
         * aligning perfectly with what `Fallout4.exe` expects, while preserving version compatibility
         * by using the native Address Library lookup.
         */
        void QueueFastTravel(RE::PlayerCharacter *a_player, const RE::ObjectRefHandle &a_marker, bool a_allowAutoSave)
        {
            using Func_t = void(RE::PlayerCharacter *, const RE::ObjectRefHandle &, bool);
            static REL::Relocation<Func_t> func{RE::ID::PlayerCharacter::QueueFastTravel};
            func(a_player, a_marker, a_allowAutoSave);
        }

        bool IsScriptFastTravelBlocked()
        {
            auto *inputManager = RE::BSInputEnableManager::GetSingleton();
            if (!inputManager)
                return false;

            constexpr auto ftFlag = RE::OtherInputEvents::OTHER_EVENT_FLAG::kFastTravel;

            RE::BSAutoLock cacheLocker(inputManager->cacheLock);
            if (inputManager->forceOtherInputEventsFlags.all(ftFlag))
                return false;

            RE::BSAutoLock layerLocker(inputManager->layerLock);
            for (const auto &layer : inputManager->layers)
            {
                if (!layer.otherInputEvents.all(ftFlag))
                {
                    return true;
                }
            }

            return false;
        }

        bool IsInteriorRestricted(RE::TESObjectCELL *parentCell)
        {
            if (parentCell && !parentCell->IsExterior())
            {
                constexpr uint16_t kCanTravelFromHere = 1u << 2;
                if (parentCell->cellFlags.all(static_cast<RE::TESObjectCELL::Flag>(kCanTravelFromHere)))
                {
                    return false;
                }
                return true;
            }
            return false;
        }

        bool IsSurvivalRestricted(RE::PlayerCharacter *a_player, RE::TESObjectCELL *parentCell, RE::TESObjectREFR *a_destinationMarker)
        {
            auto noFastTravel = RE::TESForm::GetFormByID<RE::TESGlobal>(Constants::FormID::HC_RULE_NO_FAST_TRAVEL);
            if (noFastTravel && noFastTravel->GetValue() > 0.0f)
            {
                if (a_destinationMarker)
                {
                    auto allowedList = RE::TESForm::GetFormByID<RE::BGSListForm>(Constants::FormID::HC_FAST_TRAVEL_ALLOWED_LIST);
                    if (allowedList && allowedList->ContainsItem(a_destinationMarker))
                    {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }

        bool IsPlayerOverburdened(RE::PlayerCharacter *a_player)
        {
            auto *avSingleton = RE::ActorValue::GetSingleton();
            if (avSingleton && avSingleton->mass && avSingleton->carryWeight)
            {
                float currentWeight = a_player->GetActorValue(*avSingleton->mass);
                float maxCarryWeight = a_player->GetActorValue(*avSingleton->carryWeight);

                if (currentWeight > maxCarryWeight)
                {
                    auto *strongBackPerk = RE::TESForm::GetFormByID<RE::BGSPerk>(Constants::FormID::STRONG_BACK_PERK);
                    uint8_t perkRank = strongBackPerk ? a_player->GetPerkRank(strongBackPerk) : 0;
                    if (perkRank < 4)
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        void SetEngineCustomMarker(float a_x, float a_y, uint32_t a_worldspaceId = 0)
        {
            auto *player = RE::PlayerCharacter::GetSingleton();
            if (!player)
            {
                return;
            }

            RE::TESWorldSpace* activeWorld = nullptr;
            if (a_worldspaceId != 0)
            {
                activeWorld = RE::TESForm::GetFormByID<RE::TESWorldSpace>(a_worldspaceId);
            }

            if (!activeWorld)
            {
                auto *tes = RE::TES::GetSingleton();
                activeWorld = tes ? tes->worldSpace : nullptr;

                if (!activeWorld)
                {
                    activeWorld = MAP76::Engine::GetReferenceWorldspace(player);
                }
            }

            RE::TESObjectREFR *markerRef = player->playerMapMarker ? player->playerMapMarker.get().get() : nullptr;
            if (markerRef)
            {
                markerRef->Disable();
                player->playerMapMarker.reset();
                markerRef = nullptr;
            }

            auto *markerForm = RE::TESForm::GetFormByID<RE::TESBoundObject>(0x34);
            auto *dataHandler = RE::TESDataHandler::GetSingleton();

            if (markerForm && dataHandler && activeWorld)
            {
                RE::NEW_REFR_DATA refrData{};
                refrData.location = { a_x, a_y, 0.0f };
                refrData.object = markerForm;
                refrData.world = activeWorld;
                refrData.forcePersist = true;

                auto handle = dataHandler->CreateReferenceAtLocation(refrData);
                if (auto ptr = handle.get())
                {
                    markerRef = ptr.get();
                    player->playerMapMarker = handle;
                    markerRef->Enable(false);
                }
            }
        }

        void RemoveEngineCustomMarker()
        {
            auto *player = RE::PlayerCharacter::GetSingleton();
            if (!player)
            {
                return;
            }

            if (auto handle = player->playerMapMarker)
            {
                if (auto ptr = handle.get())
                {
                    ptr->Disable();
                }
                player->playerMapMarker.reset();
            }
        }
    }

    std::string VerifyFastTravelConditions(RE::PlayerCharacter *a_player, RE::TESObjectREFR *a_destinationMarker)
    {
        if (!a_player)
        {
            return Constants::FastTravel::UNKNOWN_ERROR;
        }

        if (a_player->IsDead(false))
        {
            return Constants::FastTravel::PLAYER_DEAD;
        }

        if (IsScriptFastTravelBlocked())
        {
            return Constants::FastTravel::QUEST_LOCKED;
        }

        if (a_player->playerInCombat)
        {
            return Constants::FastTravel::COMBAT;
        }

        auto *processLists = RE::ProcessLists::GetSingleton();
        if (processLists)
        {
            RE::BSScrapArray<RE::ActorHandle> hostiles;
            if (processLists->AreHostileActorsNear(&hostiles))
            {
                return Constants::FastTravel::COMBAT;
            }
        }

        auto *parentCell = a_player->GetParentCell();
        if (IsInteriorRestricted(parentCell))
        {
            return Constants::FastTravel::INTERIOR;
        }

        if (IsSurvivalRestricted(a_player, parentCell, a_destinationMarker))
        {
            return Constants::FastTravel::SURVIVAL;
        }

        if (IsPlayerOverburdened(a_player))
        {
            return Constants::FastTravel::OVERBURDENED;
        }

        return Constants::FastTravel::SUCCESS;
    }

    void ExecuteFastTravel(uint32_t a_formId)
    {
        auto *player = RE::PlayerCharacter::GetSingleton();
        auto *genericForm = RE::TESForm::GetFormByID(a_formId);

        if (!player || !genericForm)
        {
            REX::ERROR("ExecuteFastTravel: Player or Form ID 0x{:X} could not be resolved.", a_formId);
            return;
        }

        auto *markerRef = genericForm->As<RE::TESObjectREFR>();
        if (!markerRef)
        {
            REX::ERROR("ExecuteFastTravel: Form ID 0x{:X} is not a valid 3D reference.", a_formId);
            return;
        }

        std::string status = VerifyFastTravelConditions(player, markerRef);

        if (status != Constants::FastTravel::SUCCESS)
        {
            if (UI::State::g_api && UI::State::g_view)
            {
                nlohmann::json response;
                response["status"] = status;
                response["formId"] = a_formId;
                response["locationName"] = markerRef->GetDisplayFullName();

                std::string responseStr = response.dump();
                UI::State::g_api->InteropCall(UI::State::g_view, "onFastTravelFailed", responseStr.c_str());
            }
            return;
        }

        if (auto *task = F4SE::GetTaskInterface())
        {
            task->AddUITask([markerRef]() {
                if (UI::State::g_mapIsOpen.load())
                {
                    UI::ToggleMAP76();
                }
                else if (UI::State::g_api && UI::State::g_view)
                {
                    UI::State::g_api->Unfocus(UI::State::g_view);
                    UI::State::g_api->Hide(UI::State::g_view);
                }

                auto *p = RE::PlayerCharacter::GetSingleton();
                QueueFastTravel(p, markerRef->GetHandle(), true);
            });
        }
    }

    void SetCustomMarker(float a_x, float a_y, uint32_t a_worldspaceId)
    {
        SetEngineCustomMarker(a_x, a_y, a_worldspaceId);
        MAP76::UI::TriggerFreshMapDataSync();
    }

    void RemoveCustomMarker()
    {
        RemoveEngineCustomMarker();
        MAP76::UI::TriggerFreshMapDataSync();
    }

    void ToggleQuestActive(uint32_t a_formId)
    {
        MAP76::Engine::QuestManager::ToggleQuestActive(a_formId);
    }

    void MakeOnlyQuestActive(uint32_t a_formId)
    {
        MAP76::Engine::QuestManager::MakeOnlyQuestActive(a_formId);
    }
}
