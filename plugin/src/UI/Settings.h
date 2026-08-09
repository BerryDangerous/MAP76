#pragma once
#include <string>
#include <nlohmann/json.hpp>

namespace PaperMap::UI {
    class Settings {
    public:
        static void Load();
        static void Save(const std::string& jsonString);
        
        static nlohmann::json Get();
        
        static bool freezeSimulation;
        
    private:
        static nlohmann::json data;
        static std::string GetConfigPath();
        static void UpdateVariables();
    };
}
