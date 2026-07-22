#pragma once
#include <string>
#include <vector>
#include <optional>
#include <nlohmann/json.hpp>

namespace PaperMap::UI::DTO
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
        std::string worldspaceEditorID;
        float angle;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(PlayerDTO, x, y, z, worldspace, worldspaceEditorID, angle)

    struct POIMarker
    {
        uint32_t formId;
        uint32_t worldspace;
        std::string worldspaceEditorID;
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
            {"worldspace", p.worldspace},
            {"worldspaceEditorID", p.worldspaceEditorID},
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
        std::string worldspaceEditorID;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestTarget, x, y, z, isDoor, worldspace, worldspaceEditorID)

    struct QuestObjective
    {
        std::string text;
        uint32_t status;
        std::vector<QuestTarget> targets;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestObjective, text, status, targets)

    struct QuestItem
    {
        std::string questName;
        std::string description;
        bool isTracked;
        bool isMisc;
        std::string type;
        std::vector<QuestObjective> objectives;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(QuestItem, questName, description, isTracked, isMisc, type, objectives)

    struct CustomWaypoint
    {
        uint32_t worldspace;
        std::string worldspaceEditorID;
        float x;
        float y;
    };
    NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(CustomWaypoint, worldspace, worldspaceEditorID, x, y)

    struct MapPayload
    {
        GameBounds bounds;
        std::vector<POIMarker> markers;
        std::vector<QuestItem> quests;
        std::optional<CustomWaypoint> custom_waypoint;
        std::optional<PlayerDTO> player;
    };

    inline void to_json(nlohmann::json &j, const MapPayload &p)
    {
        j = nlohmann::json{
            {"bounds", p.bounds},
            {"markers", p.markers},
            {"quests", p.quests}};
        if (p.player)
        {
            j["player"] = *p.player;
        }
        else
        {
            j["player"] = nullptr;
        }
        if (p.custom_waypoint)
        {
            j["custom_waypoint"] = *p.custom_waypoint;
        }
        else
        {
            j["custom_waypoint"] = nullptr;
        }
    }
}
