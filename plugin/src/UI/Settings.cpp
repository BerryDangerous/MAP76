#include "Settings.h"
#include <fstream>
#include <RE/Fallout.h>
#include <REX/REX.h>

namespace MAP76::UI {
    nlohmann::json Settings::data = nlohmann::json::object();
    bool Settings::freezeSimulation = true;
    bool Settings::writePayloadToFile = false;
    bool Settings::showWorkshopInfoLog = false;

    std::string Settings::GetConfigPath() {
        return "Data/F4SE/Plugins/MAP76.json";
    }

    void Settings::UpdateVariables() {
        if (data.contains("freezeSimulation") && data["freezeSimulation"].is_boolean()) {
            freezeSimulation = data["freezeSimulation"].get<bool>();
        } else {
            data["freezeSimulation"] = freezeSimulation;
        }

        if (data.contains("writePayloadToFile") && data["writePayloadToFile"].is_boolean()) {
            writePayloadToFile = data["writePayloadToFile"].get<bool>();
        } else {
            data["writePayloadToFile"] = writePayloadToFile;
        }

        if (data.contains("showWorkshopInfoLog") && data["showWorkshopInfoLog"].is_boolean()) {
            showWorkshopInfoLog = data["showWorkshopInfoLog"].get<bool>();
        } else {
            data["showWorkshopInfoLog"] = showWorkshopInfoLog;
        }
    }

    void Settings::Load() {
        std::ifstream file(GetConfigPath());
        if (file.is_open()) {
            try {
                data = nlohmann::json::parse(file);
            } catch (const nlohmann::json::parse_error& e) {
                REX::ERROR("MAP76: Error parsing settings JSON: {}", e.what());
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
            REX::ERROR("MAP76: Error saving settings JSON: {}", e.what());
        }
    }

    nlohmann::json Settings::Get() {
        return data;
    }
}
