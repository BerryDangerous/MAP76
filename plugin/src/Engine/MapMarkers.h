#pragma once
#include <RE/Fallout.h>
#include <string>
#include <vector>

namespace PaperMap::Engine::MapMarkers
{
    /**
     * @brief Holds static and dynamic state data for collected world map markers.
     */
    struct MarkerData
    {
        uint32_t formId;
        std::string name;
        uint32_t iconType;
        bool visible;
        bool canFastTravel;
        bool discovered;
        uint32_t worldspaceFormId;
        std::string worldspaceEditorID;
        RE::NiPoint3 position;
    };

    /**
     * @brief Collects all registered map markers from the Pip-Boy data manager.
     */
    std::vector<MarkerData> CollectAll(RE::PipboyDataManager *a_pipboyManager);
}
