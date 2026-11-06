#include "PCH.h"
#include "Engine/VaultBoy.h"
#include "SWF/Extractor.h"

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <format>
#include <fstream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <system_error>
#include <vector>

#include "RE/B/BSResourceNiBinaryStream.h"
#include "RE/T/TESDataHandler.h"
#include "RE/T/TESQuest.h"

namespace MAP76::Engine::VaultBoy
{
    namespace
    {
        constexpr uint32_t CACHE_FORMAT_VERSION = 1;
        const std::filesystem::path CACHE_DIR = "Data/F4SE/Plugins/MAP76/cache/vaultboys";

        /**
         * @brief Normalizes an engine asset path by converting backslashes to forward slashes
         *        and ensuring consistent formatting.
         */
        std::string NormalizeAssetPath(std::string_view a_rawPath)
        {
            std::string path(a_rawPath);
            std::replace(path.begin(), path.end(), '\\', '/');
            while (path.starts_with('/')) {
                path.erase(0, 1);
            }
            return path;
        }

        /**
         * @brief Converts a canonical Vault Boy key to a safe flat filename on disk.
         *        e.g. "Components/Quest Vault Boys/MQ101" -> "Components_Quest_Vault_Boys_MQ101.json"
         */
        std::string KeyToFilename(std::string_view a_key)
        {
            std::string filename(a_key);
            for (char& c : filename) {
                if (c == '/' || c == '\\' || c == ' ') {
                    c = '_';
                }
            }
            return filename + ".json";
        }

        /**
         * @brief Attempts to open a stream for the specified SWF path, trying both the direct
         *        path and the normalized "Interface/" prefixed path if necessary.
         */
        bool TryOpenSwfStream(const std::string& a_path, std::size_t& a_outSize, std::string& a_outResolvedPath)
        {
            {
                RE::BSResourceNiBinaryStream stream(a_path.c_str());
                if (stream) {
                    RE::NiBinaryStream::BufferInfo bufInfo{};
                    stream.GetBufferInfo(bufInfo);
                    a_outSize = bufInfo.fileSize;
                    a_outResolvedPath = a_path;
                    return true;
                }
            }

            std::string normalized = NormalizeAssetPath(a_path);
            std::string targetPath = (!normalized.starts_with("Interface/") && !normalized.starts_with("interface/"))
                ? ("Interface/" + normalized)
                : normalized;

            RE::BSResourceNiBinaryStream stream(targetPath.c_str());
            if (stream) {
                RE::NiBinaryStream::BufferInfo bufInfo{};
                stream.GetBufferInfo(bufInfo);
                a_outSize = bufInfo.fileSize;
                a_outResolvedPath = targetPath;
                return true;
            }

            return false;
        }

        /**
         * @brief Reads the entire binary contents of a resolved SWF from the VFS into a vector.
         */
        bool ReadSwfBinary(const std::string& a_resolvedPath, std::size_t a_fileSize, std::vector<uint8_t>& a_outBuffer)
        {
            if (a_fileSize == 0) {
                return false;
            }

            RE::BSResourceNiBinaryStream stream(a_resolvedPath.c_str());
            if (!stream) {
                return false;
            }

            a_outBuffer.resize(a_fileSize);
            const std::size_t bytesRead = stream.binary_read(a_outBuffer.data(), a_fileSize);
            return bytesRead == a_fileSize;
        }
    }

    std::string GetVaultBoyKey(std::string_view a_swfPath)
    {
        std::string path = NormalizeAssetPath(a_swfPath);
        if (path.starts_with("Interface/") || path.starts_with("interface/")) {
            path.erase(0, 10);
        }
        if (path.ends_with(".swf") || path.ends_with(".SWF")) {
            path.erase(path.size() - 4);
        }
        return path;
    }

    /**
     * @brief Reads SWF from VFS, extracts vector data, attaches metadata, and writes to cache file.
     * @return The serialized JSON string on success, or an empty string on failure.
     */
    static std::string ExtractAndCacheSwf(
        const std::string& a_resolvedPath,
        std::size_t a_fileSize,
        const std::filesystem::path& a_cacheFilePath)
    {
        std::vector<uint8_t> swfBytes;
        if (!ReadSwfBinary(a_resolvedPath, a_fileSize, swfBytes)) {
            REX::WARN("MAP76: Failed to read SWF stream: {}", a_resolvedPath);
            return "";
        }

        auto extracted = SWF::Extractor::Extract(swfBytes);
        if (!extracted) {
            REX::WARN("MAP76: Failed to extract SWF vector data: {}", a_resolvedPath);
            return "";
        }

        nlohmann::json root = *extracted;
        root["_meta"] = {
            {"version", CACHE_FORMAT_VERSION},
            {"sourceSwf", a_resolvedPath},
            {"sourceSize", a_fileSize}
        };

        std::string jsonStr = root.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
        std::ofstream out(a_cacheFilePath, std::ios::out | std::ios::binary);
        if (!out.is_open()) {
            REX::ERROR("MAP76: Failed to write cache file: {}", a_cacheFilePath.string());
            return "";
        }

        out << jsonStr;
        return jsonStr;
    }

    VaultBoyScanStats ScanAndCacheVaultBoys(bool a_forceRefresh)
    {
        VaultBoyScanStats stats{};
        const auto startTime = std::chrono::high_resolution_clock::now();

        auto* dataHandler = RE::TESDataHandler::GetSingleton();
        if (!dataHandler) {
            REX::WARN("MAP76: TESDataHandler singleton not available during Vault Boy scan.");
            return stats;
        }

        const auto& quests = dataHandler->GetFormArray<RE::TESQuest>();
        stats.totalQuests = quests.size();

        std::set<std::string> uniqueSwfPaths;

        for (auto* quest : quests) {
            if (!quest) {
                continue;
            }

            if (!quest->swfFile.empty()) {
                stats.questsWithSwf++;
                uniqueSwfPaths.insert(quest->swfFile.c_str());
            }
        }

        uniqueSwfPaths.insert(std::string(DEFAULT_BOY_SWF));

        stats.uniqueSwfs = uniqueSwfPaths.size();

        std::error_code ec;
        std::filesystem::create_directories(CACHE_DIR, ec);

        const auto scanEndTime = std::chrono::high_resolution_clock::now();
        stats.scanTimeMs = std::chrono::duration<double, std::milli>(scanEndTime - startTime).count();

        const auto extractStartTime = std::chrono::high_resolution_clock::now();

        for (const auto& rawPath : uniqueSwfPaths) {
            std::size_t fileSize = 0;
            std::string resolvedPath;

            if (!TryOpenSwfStream(rawPath, fileSize, resolvedPath)) {
                stats.missingSwfs++;
                continue;
            }

            stats.accessibleSwfs++;
            stats.totalSourceBytes += fileSize;

            const std::string key = GetVaultBoyKey(resolvedPath);
            const std::string filename = KeyToFilename(key);
            const auto cacheFilePath = CACHE_DIR / filename;

            bool isCacheValid = false;
            if (!a_forceRefresh && std::filesystem::exists(cacheFilePath, ec) && !ec) {
                std::ifstream file(cacheFilePath);
                if (file.is_open()) {
                    try {
                        nlohmann::json root = nlohmann::json::parse(file);
                        if (root.contains("_meta") && root["_meta"].is_object()) {
                            const auto& meta = root["_meta"];
                            if (meta.value("version", 0) == CACHE_FORMAT_VERSION &&
                                meta.value("sourceSize", static_cast<std::size_t>(0)) == fileSize) {
                                isCacheValid = true;
                            }
                        }
                    } catch (...) {
                        isCacheValid = false;
                    }
                }
            }

            if (isCacheValid) {
                stats.cacheHits++;
                auto cacheSize = std::filesystem::file_size(cacheFilePath, ec);
                if (!ec) {
                    stats.totalCacheBytes += cacheSize;
                }
            } else {
                std::string jsonStr = ExtractAndCacheSwf(resolvedPath, fileSize, cacheFilePath);
                if (!jsonStr.empty()) {
                    stats.newlyExtracted++;
                    stats.totalCacheBytes += jsonStr.size();
                } else {
                    stats.failedExtractions++;
                }
            }
        }

        const auto extractEndTime = std::chrono::high_resolution_clock::now();
        stats.extractionTimeMs = std::chrono::duration<double, std::milli>(extractEndTime - extractStartTime).count();

        REX::INFO("--------------------------------------------------------------------------------");
        REX::INFO("MAP76: Quest Vault Boy Discovery & Vector Cache Pipeline:");
        REX::INFO("  Total Quests in Engine:            {}", stats.totalQuests);
        REX::INFO("  Quests with Vault Boy SWF:         {}", stats.questsWithSwf);
        REX::INFO("  Unique SWF Assets Referenced:      {}", stats.uniqueSwfs);
        REX::INFO("  Available in VFS (BA2 / Loose):    {} / {} accessible", stats.accessibleSwfs, stats.uniqueSwfs);
        if (stats.missingSwfs > 0) {
            REX::WARN("  Missing in VFS:                    {} asset{} not found", stats.missingSwfs, stats.missingSwfs > 1 ? "s" : "");
        }
        REX::INFO("  Disk Cache Hits (Valid):           {}", stats.cacheHits);
        REX::INFO("  Newly Extracted & Cached:          {}", stats.newlyExtracted);
        if (stats.failedExtractions > 0) {
            REX::WARN("  Extraction Failures:               {}", stats.failedExtractions);
        }
        REX::INFO("  Total Source SWF Volume:           {:.2f} MB ({} bytes)", stats.totalSourceBytes / (1024.0 * 1024.0), stats.totalSourceBytes);
        REX::INFO("  Total JSON Cache Disk Volume:      {:.2f} MB ({} bytes)", stats.totalCacheBytes / (1024.0 * 1024.0), stats.totalCacheBytes);
        REX::INFO("  VFS Scan Benchmark:                {:.3f} ms", stats.scanTimeMs);
        REX::INFO("  Extraction & Caching Benchmark:    {:.3f} ms", stats.extractionTimeMs);
        REX::INFO("--------------------------------------------------------------------------------");

        return stats;
    }

    std::string GetAnimationJSON(const std::string& a_key)
    {
        const std::string filename = KeyToFilename(a_key);
        const auto cacheFilePath = CACHE_DIR / filename;

        std::error_code ec;
        if (std::filesystem::exists(cacheFilePath, ec) && !ec) {
            auto size = std::filesystem::file_size(cacheFilePath, ec);
            if (!ec && size > 0) {
                std::ifstream file(cacheFilePath, std::ios::in | std::ios::binary);
                if (file.is_open()) {
                    std::string content;
                    content.resize(size);
                    file.read(content.data(), size);
                    return content;
                }
            }
        }

        std::size_t fileSize = 0;
        std::string resolvedPath;
        if (TryOpenSwfStream(a_key + ".swf", fileSize, resolvedPath) ||
            TryOpenSwfStream("Interface/" + a_key + ".swf", fileSize, resolvedPath)) {
            return ExtractAndCacheSwf(resolvedPath, fileSize, cacheFilePath);
        }

        return "";
    }
}

