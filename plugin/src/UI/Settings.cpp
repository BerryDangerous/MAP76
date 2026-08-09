#include "Settings.h"
#include <fstream>
#include <RE/Fallout.h>
#include <REX/REX.h>

namespace PaperMap::UI {
    nlohmann::json Settings::data = nlohmann::json::object();
    bool Settings::freezeSimulation = true;

    std::string Settings::GetConfigPath() {
        return "Data/F4SE/Plugins/f4map.json";
    }

    void Settings::UpdateVariables() {
        if (data.contains("freezeSimulation") && data["freezeSimulation"].is_boolean()) {
            freezeSimulation = data["freezeSimulation"].get<bool>();
        } else {
            data["freezeSimulation"] = freezeSimulation;
        }
    }

    void Settings::Load() {
        std::ifstream file(GetConfigPath());
        if (file.is_open()) {
            try {
                data = nlohmann::json::parse(file);
            } catch (const nlohmann::json::parse_error& e) {
                REX::ERROR("f4map: Error parsing settings JSON: {}", e.what());
                data = nlohmann::json::object();
            }
        }
        UpdateVariables();
        
        std::ofstream outfile(GetConfigPath());
        if (outfile.is_open()) {
            outfile << data.dump(4);
        }
    }

    void Settings::Save(const std::string& jsonString) {
        try {
            data = nlohmann::json::parse(jsonString);
            UpdateVariables();
            
            std::ofstream outfile(GetConfigPath());
            if (outfile.is_open()) {
                outfile << data.dump(4);
            }
        } catch (const nlohmann::json::parse_error& e) {
            REX::ERROR("f4map: Error saving settings JSON: {}", e.what());
        }
    }

    nlohmann::json Settings::Get() {
        return data;
    }
}
