#include "PCH.h"
#include "UI/Payload.h"
#include "UI/DTO/MapPayload.h"
#include "Engine/MapData.h"
#include "Engine/MapMarkers.h"
#include "Engine/QuestManager.h"
#include "Engine/Player.h"

namespace PaperMap::UI::Payload
{
    std::string GetMapPayloadAsJSON()
    {
        try
        {
            DTO::MapPayload payload{};

            Engine::MapBoundsData engineBounds = Engine::GetEngineMapBounds();
            payload.bounds = DTO::GameBounds{
                engineBounds.minX,
                engineBounds.maxX,
                engineBounds.minY,
                engineBounds.maxY
            };

            Engine::Player::State enginePlayer = Engine::Player::GetCurrentState();
            payload.player = DTO::PlayerDTO{
                enginePlayer.position.x,
                enginePlayer.position.y,
                enginePlayer.position.z,
                enginePlayer.worldspaceFormID,
                enginePlayer.headingDegrees
            };

            auto *pipboyManager = RE::PipboyDataManager::GetSingleton();
            if (pipboyManager)
            {
                std::vector<Engine::MapMarkers::MarkerData> engineMarkers = Engine::MapMarkers::CollectAll(pipboyManager);
                payload.markers.reserve(engineMarkers.size());
                for (const auto& marker : engineMarkers)
                {
                    payload.markers.push_back(DTO::POIMarker{
                        marker.formId,
                        marker.worldspaceFormId,
                        marker.position.x,
                        marker.position.y,
                        marker.iconType,
                        marker.name,
                        marker.visible,
                        marker.canFastTravel,
                        marker.discovered,
                        std::nullopt
                    });
                }

                std::vector<Engine::QuestManager::QuestData> engineQuests = Engine::QuestManager::CollectAll(pipboyManager);
                payload.quests.reserve(engineQuests.size());
                for (const auto& quest : engineQuests)
                {
                    DTO::QuestItem questDto{};
                    questDto.questName = quest.questName;
                    questDto.description = quest.description;
                    questDto.isTracked = quest.isTracked;
                    questDto.isMisc = quest.isMisc;
                    questDto.type = quest.type;

                    questDto.objectives.reserve(quest.objectives.size());
                    for (const auto& objective : quest.objectives)
                    {
                        DTO::QuestObjective objDto{};
                        objDto.text = objective.text;
                        objDto.status = objective.status;

                        objDto.targets.reserve(objective.targets.size());
                        for (const auto& target : objective.targets)
                        {
                            objDto.targets.push_back(DTO::QuestTarget{
                                target.position.x,
                                target.position.y,
                                target.position.z,
                                target.isDoor,
                                target.worldspaceFormID
                            });
                        }
                        questDto.objectives.push_back(objDto);
                    }
                    payload.quests.push_back(questDto);
                }
            }

            payload.custom_waypoint = std::nullopt;

            nlohmann::json rootPayload = payload;
            return rootPayload.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace);
        }
        catch (const std::exception &e)
        {
            REX::ERROR("Exception in GetMapPayloadAsJSON parsing layer: {}", e.what());
            return "{\"bounds\":null,\"markers\":[],\"quests\":[],\"player\":null,\"custom_waypoint\":null}";
        }
    }
}
