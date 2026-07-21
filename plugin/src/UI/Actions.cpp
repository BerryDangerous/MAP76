#include <nlohmann/json.hpp>
#include "PCH.h"
#include "UI/Actions.h"
#include "UI/Interop.h"
#include "Constants.h"

namespace PaperMap::UI::Actions
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

        bool IsInteriorRestricted(RE::TESObjectCELL *parentCell)
        {
            if (parentCell && !parentCell->IsExterior())
            {
                if (parentCell->GetFormID() != Constants::FormID::INSTITUTE_CONCOURSE)
                {
                    return true;
                }
            }
            return false;
        }

        bool IsSurvivalRestricted(RE::PlayerCharacter *a_player, RE::TESObjectCELL *parentCell)
        {
            auto difficulty = a_player->GetDifficultyLevel();
            if (difficulty == RE::DifficultyLevel::kTrueSurvival || difficulty == RE::DifficultyLevel::kSurvival)
            {
                bool isInsideInstitute = (parentCell && parentCell->GetFormID() == Constants::FormID::INSTITUTE_CONCOURSE);
                if (!isInsideInstitute)
                {
                    return true;
                }
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
    }

    std::string VerifyFastTravelConditions(RE::PlayerCharacter *a_player)
    {
        if (!a_player)
        {
            return Constants::FastTravel::UNKNOWN_ERROR;
        }

        if (a_player->IsDead(false))
        {
            return Constants::FastTravel::PLAYER_DEAD;
        }
        if (a_player->playerInCombat)
        {
            auto *processLists = RE::ProcessLists::GetSingleton();
            if (!processLists)
            {
                return Constants::FastTravel::COMBAT;
            }

            uint32_t losCount = 0;
            int16_t detectionLevel = processLists->RequestHighestDetectionLevelAgainstActor(a_player, losCount);
            if (detectionLevel >= 3)
            {
                return Constants::FastTravel::COMBAT;
            }
        }

        auto *parentCell = a_player->GetParentCell();
        if (IsInteriorRestricted(parentCell))
        {
            return Constants::FastTravel::INTERIOR;
        }

        if (IsSurvivalRestricted(a_player, parentCell))
        {
            return Constants::FastTravel::SURVIVAL;
        }

        if (IsPlayerOverburdened(a_player))
        {
            return Constants::FastTravel::OVERBURDENED;
        }

        auto *controlMap = RE::ControlMap::GetSingleton();
        if (controlMap && controlMap->contextPriorityStack.empty())
        {
            return Constants::FastTravel::QUEST_LOCKED;
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

        std::string status = VerifyFastTravelConditions(player);
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

        if (UI::State::g_mapIsOpen.load())
        {
            UI::TogglePaperMap();
        }
        else if (UI::State::g_api && UI::State::g_view)
        {
            UI::State::g_api->Unfocus(UI::State::g_view);
            UI::State::g_api->Hide(UI::State::g_view);
        }

        QueueFastTravel(player, markerRef->GetHandle(), true);
    }
}
