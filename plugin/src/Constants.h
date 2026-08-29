#pragma once
#include <stdint.h>
#include <string>

namespace MAP76::Constants
{
    constexpr uintptr_t MIN_VALID_USER_PTR = 0x10000;
    constexpr uintptr_t PIPBOY_VALUE_PAYLOAD_OFFSET = 0x18;

    namespace Input
    {
        constexpr uint32_t KEY_M = 0x4D;
    }

    namespace FormID
    {
        constexpr uint32_t PLAYER = 0x14;
        constexpr uint32_t COMMONWEALTH = 0x3C;
        constexpr uint32_t STRONG_BACK_PERK = 0x00146098;
        constexpr uint32_t HC_RULE_NO_FAST_TRAVEL = 0x0000080D;
        constexpr uint32_t HC_FAST_TRAVEL_ALLOWED_LIST = 0x00000852;
    }

    namespace FastTravel
    {
        constexpr const char* SUCCESS = "SUCCESS";
        constexpr const char* PLAYER_DEAD = "PLAYER_DEAD";
        constexpr const char* COMBAT = "COMBAT";
        constexpr const char* INTERIOR = "INTERIOR";
        constexpr const char* SURVIVAL = "SURVIVAL";
        constexpr const char* OVERBURDENED = "OVERBURDENED";
        constexpr const char* QUEST_LOCKED = "QUEST_LOCKED";
        constexpr const char* UNKNOWN_ERROR = "UNKNOWN_ERROR";
    }

    namespace Map
    {
        constexpr float CELL_SIZE_UNITS = 4096.0f;
        constexpr float DEFAULT_BOUNDS_MIN_X = -125000.0f;
        constexpr float DEFAULT_BOUNDS_MAX_X = 125000.0f;
        constexpr float DEFAULT_BOUNDS_MIN_Y = -125000.0f;
        constexpr float DEFAULT_BOUNDS_MAX_Y = 125000.0f;
        constexpr float RAD_TO_DEG = 180.0f / 3.14159265f;
    }

    namespace Marker
    {
        constexpr uint32_t MAX_VALID_ICON_ID = 80;
        constexpr uint32_t CUSTOM_PIN_ICON_ID = 86;
        constexpr size_t FLAGS_OFFSET = 0x10;
        constexpr size_t ICON_OFFSET = 0x12;

        constexpr uint8_t FLAG_VISIBLE = 0x01;
        constexpr uint8_t FLAG_FAST_TRAVEL = 0x02;
        constexpr uint8_t FLAG_DISCOVERED = 0x04;
    }

    namespace Quest
    {
        constexpr uint32_t FORM_TYPE_ID = 80;
        constexpr uint32_t OBJECTIVE_STATE_INACTIVE = 0;
        constexpr uint32_t OBJECTIVE_STATE_ACTIVE = 1;
        constexpr uint32_t OBJECTIVE_STATE_COMPLETED = 2;

        constexpr int32_t TYPE_MAIN = 1;
        constexpr int32_t TYPE_BROTHERHOOD = 2;
        constexpr int32_t TYPE_INSTITUTE = 3;
        constexpr int32_t TYPE_MINUTEMEN = 4;
        constexpr int32_t TYPE_RAILROAD = 5;
        constexpr int32_t TYPE_MISC = 6;
        constexpr int32_t TYPE_SIDE = 7;
        constexpr int32_t TYPE_AUTOMATRON = 8;
        constexpr int32_t TYPE_WASTELAND_WORKSHOP = 9;
        constexpr int32_t TYPE_FAR_HARBOR = 10;

        const std::string TYPE_NAMES[] = {
            "Side",              // 0
            "Main",              // 1
            "Brotherhood",       // 2
            "Institute",         // 3
            "Minutemen",         // 4
            "Railroad",          // 5
            "Misc",              // 6
            "Side",              // 7
            "Automatron",        // 8
            "WastelandWorkshop", // 9
            "FarHarbor"          // 10
        };
    }

    namespace Workshop
    {
        constexpr uint32_t WORKSHOP_PARENT_QUEST_FORM_ID = 0x0002058E;

        constexpr std::string_view GLOBAL_DLC04_RAID_VASSAL_DISTANCE = "DLC04RaidVassalDistance";

        constexpr std::string_view KEYWORD_CARAVAN_START = "WorkshopLinkCaravanStart";
        constexpr std::string_view KEYWORD_CARAVAN_END = "WorkshopLinkCaravanEnd";
        constexpr std::string_view KEYWORD_RAIDER_SETTLEMENT = "WorkshopType02";
        constexpr std::string_view KEYWORD_VASSAL_SETTLEMENT = "WorkshopType02Vassal";
        constexpr std::string_view KEYWORD_VASSAL_EXCLUDED = "WorkshopType02AlwaysExclude";
        constexpr std::string_view KEYWORD_SETTLEMENT = "LocTypeWorkshopSettlement";
        constexpr std::string_view KEYWORD_VR_WORKSHOP = "VRWorkshopShared_Keyword_WorkshopTypeVR";
    }
}
