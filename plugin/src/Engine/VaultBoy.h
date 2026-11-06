#pragma once
#include <string>
#include <string_view>

namespace MAP76::Engine::VaultBoy
{
    inline constexpr std::string_view DEFAULT_BOY_SWF = "Interface/Components/Quest Vault Boys/Miscellaneous Quests/DefaultBoy.swf";
    inline constexpr std::string_view DEFAULT_BOY_KEY = "Components/Quest Vault Boys/Miscellaneous Quests/DefaultBoy";

    /**
     * @brief Aggregated metrics from scanning and caching quest Vault Boy animations.
     */
    struct VaultBoyScanStats
    {
        std::size_t totalQuests{0};
        std::size_t questsWithSwf{0};
        std::size_t uniqueSwfs{0};
        std::size_t accessibleSwfs{0};
        std::size_t missingSwfs{0};
        std::size_t cacheHits{0};
        std::size_t newlyExtracted{0};
        std::size_t failedExtractions{0};
        std::size_t totalSourceBytes{0};
        std::size_t totalCacheBytes{0};
        double scanTimeMs{0.0};
        double extractionTimeMs{0.0};
    };

    /**
     * @brief Derives a canonical, normalized cache key from a quest SWF asset path.
     *        e.g. "Interface/Components/Quest Vault Boys/MQ101.swf" -> "Components/Quest Vault Boys/MQ101"
     */
    [[nodiscard]] std::string GetVaultBoyKey(std::string_view a_swfPath);

    /**
     * @brief Scans all registered TESQuest forms, checks and populates the persistent disk cache
     *        in Data/F4SE/Plugins/MAP76/cache/vaultboys/, and logs discovery and extraction benchmarks.
     * @param a_forceRefresh If true, forces re-extraction of all assets regardless of cache existence.
     * @return Aggregated discovery and cache statistics.
     */
    VaultBoyScanStats ScanAndCacheVaultBoys(bool a_forceRefresh = false);

    /**
     * @brief Retrieves the raw JSON string for an extracted Vault Boy animation from disk cache,
     *        falling back to on-demand extraction if not yet cached.
     * @param a_key Canonical Vault Boy key.
     * @return Serialized JSON string, or empty string if not found.
     */
    [[nodiscard]] std::string GetAnimationJSON(const std::string& a_key);
}
