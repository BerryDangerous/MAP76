#pragma once
#include <string>
#include <vector>
#include <RE/Fallout.h>

namespace MAP76::Engine::WorkshopManager
{
    struct PipboyMarkerIndex
    {
        std::unordered_map<uint32_t, RE::PipboyObject *> locationsByLocationId;
        std::unordered_map<uint32_t, RE::PipboyObject *> locationsByMarkerId;
    };

    struct RawWorkshopData
    {
        uint32_t formId{0};
        uint32_t locationFormId{0};
        uint32_t markerFormId{0};
        uint16_t iconType{0};
        uint32_t worldspace{0};
        std::string name;
        bool isOwned{false};
        bool isSettlement{false};
        bool isInterior{false};
        bool isRaider{false};
        bool isVassal{false};
        bool isExcludedFromVassal{false};
        bool isVR{false};
        uint32_t population{0};
        uint32_t happiness{0};
        float food{0.0f};
        float water{0.0f};
        float power{0.0f};
        float defense{0.0f};
        float beds{0.0f};
        std::vector<uint32_t> linkedLocationIds;
        RE::TESObjectREFR *workshopRef{nullptr};
        RE::BGSLocation *location{nullptr};
    };

    /**
     * @brief Holds structured live data for a registered settlement (WorkshopParent-registered, LocTypeWorkshopSettlement).
     */
    struct SettlementData
    {
        uint32_t formId{0};
        uint32_t locationFormId{0};
        uint32_t markerFormId{0};
        uint16_t iconType{0};
        uint32_t worldspace{0};
        std::string name;
        bool owned{false};
        bool raider{false};
        bool vassal{false};
        bool excludedFromVassal{false};
        bool vr{false};
        uint32_t population{0};
        uint32_t happiness{0};
        float food{0.0f};
        float water{0.0f};
        float power{0.0f};
        float defense{0.0f};
        float beds{0.0f};
        std::vector<uint32_t> linkedLocationFormIds;
    };

    /**
     * @brief Collects and classifies all registered workshops into settlements, player homes, and VR workshops.
     * @param a_pipboyManager Pointer to the engine PipboyDataManager instance.
     * @return WorkshopCollectionResult containing categorized data.
     */
    std::vector<SettlementData> CollectAllWorkshops(RE::PipboyDataManager *a_pipboyManager);

    std::optional<float> GetVassalDistanceGlobal();
}
