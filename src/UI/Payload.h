#pragma once
#include <string>

namespace MAP76::UI::Payload
{
    /**
     * @brief Serializes the active world state, player details, map markers, and
     *        tracked quests into a unified JSON string payload for the UI layer.
     *
     * This is the primary data pipeline for the map interface. It handles:
     *  - Player worldspace coordinates and camera angle conversion.
     *  - Filtering active map markers (including custom fast-travel pins).
     *  - Constructing a complex Quest/Objective/Target tree for both standard
     *    and Miscellaneous-type quest systems.
     *
     * @return A serialized JSON string containing: bounds, player, markers, and quests.
     */
    std::string GetMapPayloadAsJSON();
    std::string GetFrameTickPayloadAsJSON();
    std::string GetAssetPayloadAsJSON(bool forceRefresh = false);
}
