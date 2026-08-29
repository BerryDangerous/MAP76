#pragma once
#include <string>
#include <vector>
#include <optional>
#include <nlohmann/json.hpp>

namespace MAP76::UI::DTO
{
    struct GameBounds
    {
        float minX;
        float maxX;
        float minY;
        float maxY;
        int16_t nwCellX;
        int16_t nwCellY;
        int16_t seCellX;
        int16_t seCellY;
        uint32_t usableWidth;
        uint32_t usableHeight;
        float mapScale;
        float mapOffsetX;
        float mapOffsetY;
        float mapOffsetZ;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(GameBounds, minX, maxX, minY, maxY, nwCellX, nwCellY, seCellX, seCellY, usableWidth, usableHeight, mapScale, mapOffsetX, mapOffsetY, mapOffsetZ)

    struct PlayerDTO
    {
        float x;
        float y;
        float z;
        uint32_t worldspace;
        float angle;
        float caps;
        float currentWeight;
        float maxWeight;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(PlayerDTO, x, y, z, worldspace, angle, caps, currentWeight, maxWeight)

    struct POIMarker
    {
        uint32_t formId;
        std::string pluginName;
        uint32_t localFormId;
        uint32_t worldspace;
        float x;
        float y;
        uint32_t type;
        std::string name;
        bool visible;
        bool canFastTravel;
        bool discovered;
        std::optional<std::string> customIcon;
    };

    inline void to_json(nlohmann::json &j, const POIMarker &p)
    {
        j = nlohmann::json{
            {"formId", p.formId},
            {"pluginName", p.pluginName},
            {"localFormId", p.localFormId},
            {"worldspace", p.worldspace},
            {"x", p.x},
            {"y", p.y},
            {"type", p.type},
            {"name", p.name},
            {"visible", p.visible},
            {"canFastTravel", p.canFastTravel},
            {"discovered", p.discovered}};
        if (p.customIcon)
        {
            j["customIcon"] = *p.customIcon;
        }
    }

    struct QuestTarget
    {
        float x;
        float y;
        float z;
        bool isDoor;
        uint32_t worldspace;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestTarget, x, y, z, isDoor, worldspace)

    struct QuestObjective
    {
        uint32_t index;
        std::string text;
        uint32_t state;
        std::vector<QuestTarget> targets;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestObjective, index, text, state, targets)

    struct QuestItem
    {
        uint32_t formId;
        std::string questName;
        std::string journal;
        bool isTracked;
        bool isMisc;
        std::string type;
        std::vector<QuestObjective> objectives;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestItem, formId, questName, journal, isTracked, isMisc, type, objectives)

    struct CustomMarker
    {
        uint32_t worldspace;
        float x;
        float y;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(CustomMarker, worldspace, x, y)

    struct PowerArmorMarker
    {
        uint32_t worldspace;
        float x;
        float y;
        float z;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(PowerArmorMarker, worldspace, x, y, z)

    struct SettlementDTO
    {
        uint32_t formId;
        uint32_t locationFormId;
        uint32_t markerFormId;
        uint16_t iconType;
        uint32_t worldspace;
        std::string name;
        bool owned;
        bool raider;
        bool vassal;
        std::optional<bool> excludedFromVassal;
        bool vr;
        uint32_t population;
        uint32_t happiness;
        float food;
        float water;
        float power;
        float defense;
        float beds;
        std::vector<uint32_t> linkedLocationFormIds;
    };

    inline void to_json(nlohmann::json &j, const SettlementDTO &s)
    {
        j = nlohmann::json{
            {"formId", s.formId},
            {"locationFormId", s.locationFormId},
            {"markerFormId", s.markerFormId},
            {"iconType", s.iconType},
            {"worldspace", s.worldspace},
            {"name", s.name},
            {"owned", s.owned},
            {"raider", s.raider},
            {"vassal", s.vassal},
            {"vr", s.vr},
            {"population", s.population},
            {"happiness", s.happiness},
            {"food", s.food},
            {"water", s.water},
            {"power", s.power},
            {"defense", s.defense},
            {"beds", s.beds},
            {"linkedLocationFormIds", s.linkedLocationFormIds}};
        if (s.excludedFromVassal)
        {
            j["excludedFromVassal"] = *s.excludedFromVassal;
        }
    }

    struct WorldspaceDTO
    {
        std::string editorID;
        std::string fullName;
        GameBounds bounds;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(WorldspaceDTO, editorID, fullName, bounds)

    struct GatewayMarker
    {
        float x;
        float y;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(GatewayMarker, x, y)

    struct MapPayload
    {
        std::vector<POIMarker> markers;
        std::vector<QuestItem> quests;
        std::vector<SettlementDTO> settlements;
        std::unordered_map<uint32_t, WorldspaceDTO> worldspaces;
        std::unordered_map<uint32_t, std::unordered_map<uint32_t, std::vector<GatewayMarker>>> gateways;
        std::optional<CustomMarker> custom_marker;
        std::optional<PowerArmorMarker> power_armor;
        std::optional<PlayerDTO> player;
        std::optional<float> dlc04VassalDistance;
    };

    inline void to_json(nlohmann::json &j, const MapPayload &p)
    {
        j = nlohmann::json{
            {"markers", p.markers},
            {"quests", p.quests},
            {"settlements", p.settlements}};
            
        nlohmann::json wsJson = nlohmann::json::object();
        for (const auto &[key, val] : p.worldspaces)
        {
            wsJson[std::to_string(key)] = val;
        }
        j["worldspaces"] = wsJson;

        nlohmann::json gwJson = nlohmann::json::object();
        for (const auto &[srcKey, targetMap] : p.gateways)
        {
            nlohmann::json targetJson = nlohmann::json::object();
            for (const auto &[tgtKey, markers] : targetMap)
            {
                targetJson[std::to_string(tgtKey)] = markers;
            }
            gwJson[std::to_string(srcKey)] = targetJson;
        }
        j["gateways"] = gwJson;
        if (p.player)
        {
            j["player"] = *p.player;
        }
        else
        {
            j["player"] = nullptr;
        }
        if (p.custom_marker)
        {
            j["custom_marker"] = *p.custom_marker;
        }
        else
        {
            j["custom_marker"] = nullptr;
        }
        if (p.power_armor)
        {
            j["power_armor"] = *p.power_armor;
        }
        else
        {
            j["power_armor"] = nullptr;
        }
        if (p.dlc04VassalDistance)
        {
            j["dlc04VassalDistance"] = *p.dlc04VassalDistance;
        }
    }
}
