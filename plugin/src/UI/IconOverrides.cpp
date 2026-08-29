#include "PCH.h"
#include "UI/IconOverrides.h"
#include <filesystem>
#include <fstream>
#include <unordered_map>
#include <vector>
#include <algorithm>
#include <nlohmann/json.hpp>

namespace
{
    std::unordered_map<std::string, std::string> g_overrideMap;

    std::string MakeKey(const std::string& pluginName, uint32_t localFormId)
    {
        return pluginName + ":" + std::to_string(localFormId);
    }
}

namespace MAP76::UI::IconOverrides
{
    void Load()
    {
        g_overrideMap.clear();

        const std::filesystem::path overridesDir =
            "Data/PrismaUI_F4/views/MAP76/assets/icons/location/overrides";

        if (!std::filesystem::exists(overridesDir) || !std::filesystem::is_directory(overridesDir))
        {
            REX::INFO("MAP76 IconOverrides: Directory not found, no overrides loaded ({})", overridesDir.string());
            return;
        }

        std::vector<std::filesystem::path> jsonFiles;
        for (const auto& entry : std::filesystem::directory_iterator(overridesDir))
        {
            if (entry.is_regular_file() && entry.path().extension() == ".json")
            {
                jsonFiles.push_back(entry.path());
            }
        }
        std::sort(jsonFiles.begin(), jsonFiles.end());

        uint32_t totalOverrides = 0;
        for (const auto& filePath : jsonFiles)
        {
            std::ifstream file(filePath);
            if (!file.is_open())
            {
                REX::WARN("MAP76 IconOverrides: Failed to open {}", filePath.string());
                continue;
            }

            nlohmann::json root;
            try
            {
                root = nlohmann::json::parse(file);
            }
            catch (const nlohmann::json::parse_error& e)
            {
                REX::ERROR("MAP76 IconOverrides: Parse error in {}: {}", filePath.string(), e.what());
                continue;
            }

            if (!root.contains("markerOverrides") || !root["markerOverrides"].is_object())
            {
                REX::WARN("MAP76 IconOverrides: Missing or invalid 'markerOverrides' object in {}", filePath.string());
                continue;
            }

            uint32_t fileOverrides = 0;
            const auto& markerOverrides = root["markerOverrides"];
            for (auto& [pluginName, entries] : markerOverrides.items())
            {
                if (!entries.is_array())
                {
                    REX::WARN("MAP76 IconOverrides: Expected array for plugin '{}' in {}", pluginName, filePath.string());
                    continue;
                }

                for (const auto& entry : entries)
                {
                    if (!entry.contains("localFormId") || !entry["localFormId"].is_number_unsigned())
                    {
                        REX::WARN("MAP76 IconOverrides: Entry missing 'localFormId' under plugin '{}' in {}", pluginName, filePath.string());
                        continue;
                    }
                    if (!entry.contains("icon") || !entry["icon"].is_string())
                    {
                        REX::WARN("MAP76 IconOverrides: Entry missing 'icon' under plugin '{}' in {}", pluginName, filePath.string());
                        continue;
                    }

                    uint32_t localFormId = entry["localFormId"].get<uint32_t>();
                    std::string icon = entry["icon"].get<std::string>();
                    std::string key = MakeKey(pluginName, localFormId);

                    g_overrideMap[key] = icon;
                    ++fileOverrides;
                }
            }

            REX::INFO("MAP76 IconOverrides: Loaded {} override(s) from {}", fileOverrides, filePath.filename().string());
            totalOverrides += fileOverrides;
        }

        REX::INFO("MAP76 IconOverrides: {} total override(s) loaded from {} file(s).",
            totalOverrides, static_cast<uint32_t>(jsonFiles.size()));
    }

    std::string GetCustomIcon(const std::string& pluginName, uint32_t localFormId)
    {
        const auto it = g_overrideMap.find(MakeKey(pluginName, localFormId));
        if (it != g_overrideMap.end())
        {
            return it->second;
        }
        return {};
    }
}
