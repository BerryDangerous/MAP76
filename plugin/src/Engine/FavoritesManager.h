#pragma once

#include <vector>
#include <set>
#include <cstdint>
#include <F4SE/Interfaces.h>

namespace MAP76::Engine {
    class FavoritesManager {
    public:
        static void ToggleFavorite(uint32_t formId);
        static std::vector<uint32_t> GetFavorites();
        static bool IsFavorite(uint32_t formId);

        static void RevertCallback(const F4SE::SerializationInterface* a_intfc);
        static void SaveCallback(const F4SE::SerializationInterface* a_intfc);
        static void LoadCallback(const F4SE::SerializationInterface* a_intfc);

    private:
        static std::set<uint32_t> favorites;
        static constexpr uint32_t RECORD_TYPE = 'FAVS';
        static constexpr uint32_t RECORD_VERSION = 1;
    };
}
