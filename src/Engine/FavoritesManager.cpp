#include "PCH.h"
#include "FavoritesManager.h"
#include <REX/REX.h>

namespace MAP76::Engine {
    std::set<uint32_t> FavoritesManager::favorites;

    void FavoritesManager::ToggleFavorite(uint32_t formId) {
        if (favorites.contains(formId)) {
            favorites.erase(formId);
        } else {
            favorites.insert(formId);
        }
    }

    std::vector<uint32_t> FavoritesManager::GetFavorites() {
        return std::vector<uint32_t>(favorites.begin(), favorites.end());
    }

    bool FavoritesManager::IsFavorite(uint32_t formId) {
        return favorites.contains(formId);
    }

    void FavoritesManager::RevertCallback(const F4SE::SerializationInterface* a_intfc) {
        favorites.clear();
    }

    void FavoritesManager::SaveCallback(const F4SE::SerializationInterface* a_intfc) {
        if (!a_intfc->OpenRecord(RECORD_TYPE, RECORD_VERSION)) {
            REX::ERROR("MAP76: Failed to open record for favorites serialization!");
            return;
        }

        uint32_t count = static_cast<uint32_t>(favorites.size());
        a_intfc->WriteRecordData(&count, sizeof(count));

        for (uint32_t formId : favorites) {
            a_intfc->WriteRecordData(&formId, sizeof(formId));
        }
        
        REX::INFO("MAP76: Saved {} favorites to co-save.", count);
    }

    void FavoritesManager::LoadCallback(const F4SE::SerializationInterface* a_intfc) {
        uint32_t type;
        uint32_t version;
        uint32_t length;

        while (a_intfc->GetNextRecordInfo(type, version, length)) {
            if (type != RECORD_TYPE) {
                continue;
            }

            if (version != RECORD_VERSION) {
                REX::ERROR("MAP76: Invalid favorites record version (got {}, expected {})", version, RECORD_VERSION);
                continue;
            }

            uint32_t count = 0;
            if (a_intfc->ReadRecordData(&count, sizeof(count)) != sizeof(count)) {
                REX::ERROR("MAP76: Failed to read favorites count!");
                break;
            }

            for (uint32_t i = 0; i < count; ++i) {
                uint32_t formId;
                if (a_intfc->ReadRecordData(&formId, sizeof(formId)) != sizeof(formId)) {
                    REX::ERROR("MAP76: Failed to read favorite formId!");
                    break;
                }
                favorites.insert(formId);
            }
            
            REX::INFO("MAP76: Loaded {} favorites from co-save.", count);
        }
    }
}
