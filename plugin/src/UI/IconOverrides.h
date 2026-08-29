#pragma once
#include <string>
#include <cstdint>

namespace MAP76::UI::IconOverrides
{
    /**
     * @brief Scans Data/PrismaUI_F4/views/MAP76/assets/icons/location/overrides/*.json
     *        and populates an in-memory lookup keyed by (pluginName, localFormId).
     *
     * Expected JSON schema (grouped by plugin):
     * {
     *   "markerOverrides": {
     *     "Fallout4.esm": [
     *       { "localFormId": 469576, "icon": "train-station" }
     *     ]
     *   }
     * }
     *
     * Conflict resolution: files are processed in alphabetical order by filename.
     * The last file to define an override for a given marker wins.
     *
     * Call once during kGameDataReady.
     */
    void Load();

    /**
     * @brief Returns the custom icon name for the given marker, or an empty string
     *        if no override exists.
     *
     * The returned string is the bare SVG base name without extension or
     * _undiscovered suffix (e.g. "train-station"). The UI appends the suffix
     * as needed.
     */
    std::string GetCustomIcon(const std::string& pluginName, uint32_t localFormId);
}
