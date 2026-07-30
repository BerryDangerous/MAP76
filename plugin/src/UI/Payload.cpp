#include "PCH.h"
#include "UI/Payload.h"
#include "UI/DTO/MapPayload.h"
#include "Engine/MapData.h"
#include "Engine/MapMarkers.h"
#include "Engine/QuestManager.h"
#include "Engine/WorkshopManager.h"
#include "Engine/Player.h"
#include "Engine/Memory.h"
#include "Engine/PipboyUtils.h"

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
                engineBounds.maxY,
                engineBounds.nwCellX,
                engineBounds.nwCellY,
                engineBounds.seCellX,
                engineBounds.seCellY,
                engineBounds.usableWidth,
                engineBounds.usableHeight,
                engineBounds.mapScale,
                engineBounds.mapOffsetX,
                engineBounds.mapOffsetY,
                engineBounds.mapOffsetZ
            };

            Engine::Player::State enginePlayer = Engine::Player::GetCurrentState();
            payload.player = DTO::PlayerDTO{
                enginePlayer.position.x,
                enginePlayer.position.y,
                enginePlayer.position.z,
                enginePlayer.worldspaceFormID,
                enginePlayer.worldspaceEditorID,
                enginePlayer.worldspaceFullName,
                enginePlayer.headingDegrees,
                enginePlayer.caps,
                enginePlayer.currentWeight,
                enginePlayer.maxWeight
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
                        marker.worldspaceEditorID,
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
                            objDto.targets.push_back(DTO::QuestTarget{
                                target.position.x,
                                target.position.y,
                                target.position.z,
                                target.isDoor,
                                target.worldspaceFormID,
                                target.worldspaceEditorID
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
                    DTO::SettlementDTO dto{
                        .formId = ws.formId,
                        .locationFormId = ws.locationFormId,
                        .markerFormId = ws.markerFormId,
                        .worldspace = ws.worldSpaceFormId,
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

            payload.custom_marker = std::nullopt;
            payload.power_armor = std::nullopt;

            auto *playerRef = RE::PlayerCharacter::GetSingleton();
            if (playerRef)
            {
                auto *playerWorld = PaperMap::Engine::GetReferenceWorldspace(playerRef);

                if (auto paHandle = playerRef->lastUsedPowerArmor)
                {
                    if (auto paPtr = paHandle.get())
                    {
                        auto *paRefr = paPtr.get();
                        if (paRefr && PaperMap::Engine::Memory::IsReferenceSafe(paRefr) && !paRefr->IsDisabled())
                        {
                            RE::NiPoint3 paPos = paRefr->GetPosition();
                            auto *paWorld = PaperMap::Engine::GetReferenceWorldspace(paRefr, &paPos);

                            if (playerWorld && paWorld && playerWorld->formID != paWorld->formID)
                            {
                                if (pipboyManager && pipboyManager->mapData.worldPowerArmorMarker)
                                {
                                    auto *pam = pipboyManager->mapData.worldPowerArmorMarker;
                                    bool pamVis = PaperMap::Engine::PipboyUtils::GetPipboyBool(pam, "Visible", false);
                                    if (pamVis)
                                    {
                                        float pamX = PaperMap::Engine::PipboyUtils::GetPipboyFloat(pam, "X", paPos.x);
                                        float pamY = PaperMap::Engine::PipboyUtils::GetPipboyFloat(pam, "Y", paPos.y);
                                        paPos.x = pamX;
                                        paPos.y = pamY;
                                        paWorld = playerWorld;
                                    }
                                }
                            }

                            DTO::PowerArmorMarker paMarker{};
                            paMarker.worldspace = paWorld ? paWorld->formID : 0;
                            paMarker.worldspaceEditorID = (paWorld && paWorld->GetFormEditorID()) ? paWorld->GetFormEditorID() : "";
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
                        if (wpRefr && PaperMap::Engine::Memory::IsReferenceSafe(wpRefr) && !wpRefr->IsDisabled())
                        {
                            RE::NiPoint3 wpPos = wpRefr->GetPosition();
                            auto *wpWorld = PaperMap::Engine::GetReferenceWorldspace(wpRefr, &wpPos);

                            if (playerWorld && wpWorld && playerWorld->formID != wpWorld->formID)
                            {
                                if (pipboyManager && pipboyManager->mapData.worldCustomMarker)
                                {
                                    auto *wcm = pipboyManager->mapData.worldCustomMarker;
                                    bool wcmVis = PaperMap::Engine::PipboyUtils::GetPipboyBool(wcm, "Visible", false);
                                    if (wcmVis)
                                    {
                                        float wcmX = PaperMap::Engine::PipboyUtils::GetPipboyFloat(wcm, "X", wpPos.x);
                                        float wcmY = PaperMap::Engine::PipboyUtils::GetPipboyFloat(wcm, "Y", wpPos.y);
                                        wpPos.x = wcmX;
                                        wpPos.y = wcmY;
                                        wpWorld = playerWorld;
                                    }
                                }
                            }

                            DTO::CustomMarker markerDto{};
                            markerDto.worldspace = wpWorld ? wpWorld->formID : 0;
                            markerDto.worldspaceEditorID = (wpWorld && wpWorld->GetFormEditorID()) ? wpWorld->GetFormEditorID() : "";
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
}
