#pragma once
#include <RE/Fallout.h>
#include <string>
#include <vector>

namespace MAP76::Engine::MapMarkers
{
    /**
     * @brief Holds static and dynamic state data for collected world map markers.
     */
    struct MarkerData
    {
        uint32_t formId;
        std::string pluginName;
        uint32_t localFormId;
        std::string name;
        uint32_t iconType;
        bool visible;
        bool canFastTravel;
        bool discovered;
        uint32_t worldspace;
        RE::NiPoint3 position;
    };

    /**
     * @brief Collects all registered map markers from the Pip-Boy data manager.
     */
    std::vector<MarkerData> CollectAll(RE::PipboyDataManager *a_pipboyManager);

    /**
     * @brief Extracts the icon type directly from a map marker reference.
     */
    std::optional<uint16_t> GetMarkerIconType(RE::TESObjectREFR* a_refr);
}
