#pragma once

#include "SWF/Types.h"
#include <cstdint>
#include <optional>
#include <span>

namespace MAP76::SWF
{
    /**
     * @brief High-level facade for extracting and converting Flash SWF vector animations
     *        into the lightweight, deduplicated VaultBoyAnimationData model consumed by the UI.
     */
    class Extractor
    {
    public:
        /**
         * @brief Parses an in-memory SWF file (compressed CWS or uncompressed FWS),
         *        extracts all vector shapes, deduplicates geometry, and constructs the frame timeline.
         *
         * @param a_rawSwf The raw bytes of the SWF loaded from BA2 or disk.
         * @return An extracted VaultBoyAnimationData object ready for JSON serialization,
         *         or std::nullopt if the SWF is invalid or contains no animated sprites.
         */
        [[nodiscard]] static std::optional<VaultBoyAnimationData> Extract(std::span<const uint8_t> a_rawSwf);
    };
}
