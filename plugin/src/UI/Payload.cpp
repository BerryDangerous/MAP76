#include "PCH.h"
#include "UI/Payload.h"
#include "UI/PayloadDTO.h"
#include "UI/IconOverrides.h"
#include "Engine/MapData.h"
#include "Engine/MapMarkers.h"
#include "Engine/QuestManager.h"
#include "Engine/WorkshopManager.h"
#include "Engine/Player.h"
#include "Engine/Memory.h"
#include "Engine/PipboyUtils.h"
#include <filesystem>
#include <fstream>
#include <sstream>

namespace MAP76::UI::Payload
{
    std::string GetMapPayloadAsJSON()
    {
        try
        {
            DTO::MapPayload payload{};

            Engine::Player::State enginePlayer = Engine::Player::GetCurrentState();
            payload.player = DTO::PlayerDTO{
                enginePlayer.position.x,
                enginePlayer.position.y,
                enginePlayer.position.z,
                enginePlayer.worldspace,
                enginePlayer.headingDegrees,
                enginePlayer.caps,
                enginePlayer.currentWeight,
                enginePlayer.maxWeight
            };

            auto addWorldspace = [&](uint32_t wsId) {
                if (wsId == 0 || payload.worldspaces.find(wsId) != payload.worldspaces.end()) return;
                if (auto* wspace = RE::TESForm::GetFormByID<RE::TESWorldSpace>(wsId))
                {
                    DTO::WorldspaceDTO wsDto{};
                    wsDto.editorID = wspace->GetFormEditorID() ? wspace->GetFormEditorID() : "";
                    wsDto.fullName = wspace->GetFullName() ? wspace->GetFullName() : "";

                    Engine::MapBoundsData wsBounds = Engine::GetWorldspaceBounds(wspace);
                    wsDto.bounds = DTO::GameBounds{
                        wsBounds.minX,
                        wsBounds.maxX,
                        wsBounds.minY,
                        wsBounds.maxY,
                        wsBounds.nwCellX,
                        wsBounds.nwCellY,
                        wsBounds.seCellX,
                        wsBounds.seCellY,
                        wsBounds.usableWidth,
                        wsBounds.usableHeight,
                        wsBounds.mapScale,
                        wsBounds.mapOffsetX,
                        wsBounds.mapOffsetY,
                        wsBounds.mapOffsetZ
                    };

                    payload.worldspaces[wsId] = wsDto;
                }
            };

            auto *pipboyManager = RE::PipboyDataManager::GetSingleton();
            if (pipboyManager)
            {
                std::vector<Engine::MapMarkers::MarkerData> engineMarkers = Engine::MapMarkers::CollectAll(pipboyManager);
                payload.markers.reserve(engineMarkers.size());
                for (const auto& marker : engineMarkers)
                {
                    addWorldspace(marker.worldspace);
                    payload.markers.push_back(DTO::POIMarker{
                        marker.formId,
                        marker.pluginName,
                        marker.localFormId,
                        marker.worldspace,
                        marker.position.x,
                        marker.position.y,
                        marker.iconType,
                        marker.name,
                        marker.visible,
                        marker.canFastTravel,
                        marker.discovered,
                        [&]() -> std::optional<std::string> {
                            auto icon = MAP76::UI::IconOverrides::GetCustomIcon(marker.pluginName, marker.localFormId);
                            return icon.empty() ? std::nullopt : std::optional<std::string>(icon);
                        }()
                    });
                }

                std::vector<Engine::QuestManager::QuestData> engineQuests = Engine::QuestManager::CollectAll(pipboyManager);
                payload.quests.reserve(engineQuests.size());
                for (const auto& quest : engineQuests)
                {
                    DTO::QuestItem questDto{};
                    questDto.formId = quest.formId;
                    questDto.questName = quest.questName;
                    questDto.journal = quest.journal;
                    questDto.isTracked = quest.isTracked;
                    questDto.isMisc = quest.isMisc;
                    questDto.type = quest.type;

                    questDto.objectives.reserve(quest.objectives.size());
                    for (const auto& objective : quest.objectives)
                    {
                        DTO::QuestObjective objDto{};
                        objDto.index = objective.index;
                        objDto.text = objective.text;
                        objDto.state = objective.state;

                        objDto.targets.reserve(objective.targets.size());
                        for (const auto& target : objective.targets)
                        {
                            addWorldspace(target.worldspace);
                            objDto.targets.push_back(DTO::QuestTarget{
                                target.position.x,
                                target.position.y,
                                target.position.z,
                                target.isDoor,
                                target.worldspace
                            });
                        }
                        questDto.objectives.push_back(objDto);
                    }
                    payload.quests.push_back(questDto);
                }

                payload.dlc04VassalDistance = Engine::WorkshopManager::GetVassalDistanceGlobal();
                std::vector<Engine::WorkshopManager::SettlementData> engineWorkshops = Engine::WorkshopManager::CollectAllWorkshops(pipboyManager);

                payload.settlements.reserve(engineWorkshops.size());
                for (const auto &ws : engineWorkshops)
                {
                    addWorldspace(ws.worldspace);
                    DTO::SettlementDTO dto{
                        .formId = ws.formId,
                        .locationFormId = ws.locationFormId,
                        .markerFormId = ws.markerFormId,
                        .iconType = ws.iconType,
                        .worldspace = ws.worldspace,
                        .name = ws.name,
                        .owned = ws.owned,
                        .raider = ws.raider,
                        .vassal = ws.vassal,
                        .vr = ws.vr,
                        .population = ws.population,
                        .happiness = ws.happiness,
                        .food = ws.food,
                        .water = ws.water,
                        .power = ws.power,
                        .defense = ws.defense,
                        .beds = ws.beds,
                        .linkedLocationFormIds = ws.linkedLocationFormIds};

                    if (ws.excludedFromVassal)
                    {
                        dto.excludedFromVassal = true;
                    }

                    payload.settlements.push_back(dto);
                }
            }

            static std::unordered_map<uint32_t, std::unordered_map<uint32_t, std::vector<Engine::GatewayMarker>>> cachedGatewayGraph;
            static bool hasBuiltGraph = false;
            if (!hasBuiltGraph)
            {
                cachedGatewayGraph = Engine::BuildGatewayGraph();
                hasBuiltGraph = true;
            }

            for (const auto& [sourceWorld, targets] : cachedGatewayGraph)
            {
                for (const auto& [targetWorld, markers] : targets)
                {
                    std::vector<DTO::GatewayMarker> dtoMarkers;
                    dtoMarkers.reserve(markers.size());
                    for (const auto& m : markers)
                    {
                        dtoMarkers.push_back(DTO::GatewayMarker{ m.x, m.y });
                    }
                    payload.gateways[sourceWorld][targetWorld] = dtoMarkers;
                }
            }

            payload.custom_marker = std::nullopt;
            payload.power_armor = std::nullopt;

            auto *playerRef = RE::PlayerCharacter::GetSingleton();
            if (playerRef)
            {
                auto *playerWorld = MAP76::Engine::GetReferenceWorldspace(playerRef);
                if (playerWorld) addWorldspace(playerWorld->formID);

                if (auto paHandle = playerRef->lastUsedPowerArmor)
                {
                    if (auto paPtr = paHandle.get())
                    {
                        auto *paRefr = paPtr.get();
                        if (paRefr && MAP76::Engine::Memory::IsReferenceSafe(paRefr) && !paRefr->IsDisabled())
                        {
                            RE::NiPoint3 paPos = paRefr->GetPosition();
                            auto *paWorld = MAP76::Engine::GetReferenceWorldspace(paRefr, &paPos);

                            if (paWorld) addWorldspace(paWorld->formID);
                            DTO::PowerArmorMarker paMarker{};
                            paMarker.worldspace = paWorld ? paWorld->formID : 0;
                            paMarker.x = paPos.x;
                            paMarker.y = paPos.y;
                            paMarker.z = paPos.z;
                            payload.power_armor = paMarker;
                        }
                    }
                }

                if (auto wpHandle = playerRef->playerMapMarker)
                {
                    if (auto wpPtr = wpHandle.get())
                    {
                        auto *wpRefr = wpPtr.get();
                        if (wpRefr && MAP76::Engine::Memory::IsReferenceSafe(wpRefr) && !wpRefr->IsDisabled())
                        {
                            RE::NiPoint3 wpPos = wpRefr->GetPosition();
                            auto *wpWorld = MAP76::Engine::GetReferenceWorldspace(wpRefr, &wpPos);
                            if (wpWorld) addWorldspace(wpWorld->formID);
                            DTO::CustomMarker markerDto{};
                            markerDto.worldspace = wpWorld ? wpWorld->formID : 0;
                            markerDto.x = wpPos.x;
                            markerDto.y = wpPos.y;
                            payload.custom_marker = markerDto;
                        }
                    }
                }
            }

            nlohmann::json rootPayload = payload;
            return rootPayload.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
        }
        catch (const std::exception &e)
        {
            REX::ERROR("Exception in GetMapPayloadAsJSON parsing layer: {}", e.what());
            return "{\"bounds\":null,\"markers\":[],\"quests\":[],\"settlements\":[],\"player\":null,\"custom_marker\":null,\"power_armor\":null}";
        }
    }

    std::string GetFrameTickPayloadAsJSON()
    {
        try
        {
            nlohmann::json tickPayload = nlohmann::json::object();

            auto *calendar = RE::Calendar::GetSingleton();
            if (calendar && calendar->gameHour && calendar->gameDay && calendar->gameMonth && calendar->gameYear)
            {
                tickPayload["hour"] = calendar->gameHour->value;
                tickPayload["day"] = calendar->gameDay->value;
                tickPayload["month"] = calendar->gameMonth->value;
                tickPayload["year"] = calendar->gameYear->value + 2000;
            }

            Engine::Player::State enginePlayer = Engine::Player::GetCurrentState();
            DTO::PlayerDTO playerDto{
                enginePlayer.position.x,
                enginePlayer.position.y,
                enginePlayer.position.z,
                enginePlayer.worldspace,
                enginePlayer.headingDegrees,
                enginePlayer.caps,
                enginePlayer.currentWeight,
                enginePlayer.maxWeight
            };
            
            tickPayload["player"] = playerDto;

            return tickPayload.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
        }
        catch (const std::exception &e)
        {
            REX::ERROR("Exception in GetFrameTickPayloadAsJSON: {}", e.what());
            return "{}";
        }
    }

    static std::string g_assetPayloadCache = "";

    std::string GetAssetPayloadAsJSON(bool forceRefresh)
    {
        try
        {
            if (!forceRefresh && !g_assetPayloadCache.empty())
            {
                return g_assetPayloadCache;
            }

            nlohmann::json root = nlohmann::json::object();
            nlohmann::json mapConfigs = nlohmann::json::object();
            nlohmann::json assetCache = nlohmann::json::object();

            std::filesystem::path assetsDir = "Data/PrismaUI_F4/views/MAP76/assets";
            
            if (std::filesystem::exists(assetsDir) && std::filesystem::is_directory(assetsDir))
            {
                for (const auto& entry : std::filesystem::recursive_directory_iterator(assetsDir))
                {
                    if (entry.is_regular_file())
                    {
                        auto ext = entry.path().extension().string();
                        if (ext == ".json")
                        {
                            std::ifstream file(entry.path());
                            if (file.is_open())
                            {
                                try {
                                    nlohmann::json parsed = nlohmann::json::parse(file);
                                    for (auto& [key, val] : parsed.items()) {
                                        mapConfigs[key] = val;
                                    }
                                } catch (const std::exception& e) {
                                    REX::ERROR("Failed to parse JSON config {}: {}", entry.path().string(), e.what());
                                }
                            }
                        }
                        else if (ext == ".svg")
                        {
                            std::ifstream file(entry.path());
                            if (file.is_open())
                            {
                                std::stringstream buffer;
                                buffer << file.rdbuf();
                                std::string relPath = std::filesystem::relative(entry.path(), assetsDir.parent_path()).string();
                                std::replace(relPath.begin(), relPath.end(), '\\', '/');
                                assetCache[relPath] = buffer.str();
                            }
                        }
                    }
                }
            }

            root["mapConfigs"] = mapConfigs;
            root["assetCache"] = assetCache;
            
            g_assetPayloadCache = root.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
            return g_assetPayloadCache;
        }
        catch (const std::exception &e)
        {
            REX::ERROR("Exception in GetAssetPayloadAsJSON: {}", e.what());
            return "{}";
        }
    }
}
