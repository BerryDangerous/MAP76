#pragma once
#include <RE/Fallout.h>

namespace PaperMap::Engine
{
    /**
     * @brief Holds calculated bounding coordinates (in world units) for the active map space.
     */
    struct MapBoundsData
    {
        float minX;
        float maxX;
        float minY;
        float maxY;
    };

    /**
     * @brief Calculates map bounds based on the player's current worldspace cell extents.
     * @return Bounding box in world coordinates.
     */
    MapBoundsData GetEngineMapBounds();

    /**
     * @brief Resolves the target reference's parent worldspace and translates relative position offsets.
     *
     * Handles interior fallback locations, parent worldspace hierarchy traversal, and scale offset calculations.
     *
     * @param a_refr Target reference object.
     * @param a_position Optional pointer to position vector; modified in-place if parent world offsets exist.
     * @return Resolved parent TESWorldSpace pointer, or nullptr if resolution failed.
     */
    RE::TESWorldSpace *GetReferenceWorldspace(RE::TESObjectREFR *a_refr, RE::NiPoint3* a_position = nullptr);

    /**
     * @brief Extracts the underlying quest FormID linked to a UI map marker object.
     * @param a_markerObj Pip-Boy UI marker object.
     * @return Resolved quest FormID, or 0 if unlinked/invalid.
     */
    uint32_t GetQuestFormIDFromMarker(RE::PipboyObject *a_markerObj);
}
