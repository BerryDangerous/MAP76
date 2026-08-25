#pragma once
#include <RE/Fallout.h>

namespace MAP76::Engine
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
        int16_t nwCellX{0};
        int16_t nwCellY{0};
        int16_t seCellX{0};
        int16_t seCellY{0};
        uint32_t usableWidth{0};
        uint32_t usableHeight{0};
        float mapScale{1.0f};
        float mapOffsetX{0.0f};
        float mapOffsetY{0.0f};
        float mapOffsetZ{0.0f};
    };

    struct GatewayMarker
    {
        float x;
        float y;
    };

    /**
     * @brief Builds a routing graph of all cross-worldspace gateways in the game.
     * @return A map of SourceWorldID -> TargetWorldID -> List of gateway coordinates in the SourceWorld.
     */
    std::unordered_map<uint32_t, std::unordered_map<uint32_t, std::vector<GatewayMarker>>> BuildGatewayGraph();

    /**
     * @brief Calculates map bounds based on the specified worldspace cell extents.
     * @param a_worldspace Target worldspace.
     * @return Bounding box in world coordinates.
     */
    MapBoundsData GetWorldspaceBounds(RE::TESWorldSpace* a_worldspace);

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
    RE::TESWorldSpace *GetReferenceWorldspace(RE::TESObjectREFR *a_refr, RE::NiPoint3* a_position = nullptr, bool* a_isDoor = nullptr);

    /**
     * @brief Resolves the exterior location map marker reference associated with a reference's BGSLocation chain.
     * @param a_refr Target reference object.
     * @return Resolved exterior location marker reference pointer, or nullptr if none found.
     */
    RE::TESObjectREFR *GetWorldLocationMarker(RE::TESObjectREFR *a_refr);

    /**
     * @brief Checks if a Pip-Boy UI map marker object is linked to a target quest FormID.
     * @param a_markerObj Pip-Boy UI marker object.
     * @param a_questFormID Target quest FormID.
     * @return true if linked, false otherwise.
     */
    bool IsMarkerLinkedToQuest(RE::PipboyObject *a_markerObj, uint32_t a_questFormID);
}
