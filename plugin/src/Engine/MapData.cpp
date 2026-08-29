#include "PCH.h"
#include "Engine/MapData.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Constants.h"
#include "RE/E/ExtraTeleport.h"
#include "RE/D/DoorTeleportData.h"

namespace
{
    RE::PipboyArray *GetQuestIdMember(RE::PipboyObject *a_markerObj)
    {
        if (auto *array = a_markerObj->GetMember<RE::PipboyArray *>("questId"))
        {
            return array;
        }
        if (auto *array = a_markerObj->GetMember<RE::PipboyArray *>("questID"))
        {
            return array;
        }
        if (auto *array = a_markerObj->GetMember<RE::PipboyArray *>("QuestID"))
        {
            return array;
        }
        return a_markerObj->GetMember<RE::PipboyArray *>("QuestId");
    }

    RE::TESWorldSpace* GetDirectWorldspace(RE::TESObjectREFR* a_refr)
    {
        if (auto* cell = a_refr->GetParentCell())
        {
            if (MAP76::Engine::Memory::IsValidWorldspace(cell->worldSpace))
            {
                return cell->worldSpace;
            }
        }

        if (auto* cell = a_refr->GetSaveParentCell())
        {
            if (MAP76::Engine::Memory::IsValidWorldspace(cell->worldSpace))
            {
                return cell->worldSpace;
            }
        }

        return nullptr;
    }

    RE::TESWorldSpace* ResolveInteriorWorldspace(RE::TESObjectREFR* a_refr, RE::NiPoint3* a_position, bool* a_isDoor = nullptr)
    {
        auto* pipboyManager = RE::PipboyDataManager::GetSingleton();

        if (a_refr->formID == MAP76::Constants::FormID::PLAYER)
        {
            if (pipboyManager && a_position)
            {
                *a_position = pipboyManager->mapData.playerLastWorldPosition;
            }
        }

        auto* cell = a_refr->GetParentCell();
        if (!cell)
        {
            cell = a_refr->GetSaveParentCell();
        }

        if (cell)
        {
            RE::TESWorldSpace* candidateWorld = nullptr;
            auto* cellLoc = cell->GetLocation();
            for (auto& refPtr : cell->references)
            {
                if (auto* ref = refPtr.get())
                {
                    if (ref->extraList)
                    {
                        if (auto* extraTeleport = ref->extraList->GetByType<RE::ExtraTeleport>())
                        {
                            if (extraTeleport->teleportData && extraTeleport->teleportData->linkedDoor.get_handle() != 0)
                            {
                                auto linkedHandle = extraTeleport->teleportData->linkedDoor;
                                RE::TESObjectREFR* destDoor = nullptr;
                                if (auto ptr = linkedHandle.get())
                                {
                                    destDoor = ptr.get();
                                }
                                if (!destDoor)
                                {
                                    destDoor = RE::TESForm::GetFormByID<RE::TESObjectREFR>(linkedHandle.get_handle());
                                }

                                if (destDoor)
                                {
                                    if (auto* exteriorWorld = GetDirectWorldspace(destDoor))
                                    {
                                        if (cellLoc)
                                        {
                                            if (auto* destCell = destDoor->GetParentCell())
                                            {
                                                if (auto* destLoc = destCell->GetLocation())
                                                {
                                                    if (cellLoc == destLoc || cellLoc->IsChild(destLoc) || cellLoc->IsParent(destLoc))
                                                    {
                                                        if (a_position) *a_position = destDoor->GetPosition();
                                                        if (a_isDoor) *a_isDoor = true;
                                                        return exteriorWorld;
                                                    }
                                                }
                                            }
                                        }
                                        if (!candidateWorld)
                                        {
                                            if (a_position) *a_position = destDoor->GetPosition();
                                            if (a_isDoor) *a_isDoor = true;
                                            candidateWorld = exteriorWorld;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (candidateWorld)
            {
                return candidateWorld;
            }


            if (auto* location = cell->GetLocation())
            {
                auto* currentLoc = location;
                while (currentLoc)
                {
                    auto markerHandle = currentLoc->worldLocMarker;
                    if (markerHandle)
                    {
                        RE::TESObjectREFR* markerRef = nullptr;
                        if (auto ptr = markerHandle.get())
                        {
                            markerRef = ptr.get();
                        }
                        if (!markerRef && markerHandle.get_handle() != 0)
                        {
                            markerRef = RE::TESForm::GetFormByID<RE::TESObjectREFR>(markerHandle.get_handle());
                        }

                        if (markerRef)
                        {
                            auto* cellWorld = GetDirectWorldspace(markerRef);
                            if (cellWorld)
                            {
                                if (a_position) *a_position = markerRef->GetPosition();
                                return cellWorld;
                            }
                        }
                    }
                    currentLoc = currentLoc->parentLoc;
                }
            }
        }

        if (pipboyManager && pipboyManager->mapData.worldPlayerMarker)
        {
            uint32_t worldFormID = MAP76::Engine::PipboyUtils::GetPipboyUint32(pipboyManager->mapData.worldPlayerMarker, "WorldspaceID", 0);
            if (worldFormID == 0)
            {
                worldFormID = MAP76::Engine::PipboyUtils::GetPipboyUint32(pipboyManager->mapData.worldPlayerMarker, "Worldspace", 0);
            }
            if (worldFormID != 0)
            {
                if (auto* wspace = RE::TESForm::GetFormByID<RE::TESWorldSpace>(worldFormID))
                {
                    return wspace;
                }
            }
        }

        auto* tes = RE::TES::GetSingleton();
        if (tes && tes->worldSpace)
        {
            return tes->worldSpace;
        }

        auto* form = RE::TESForm::GetFormByID(MAP76::Constants::FormID::COMMONWEALTH);
        return form ? reinterpret_cast<RE::TESWorldSpace*>(form) : nullptr;
    }

    RE::TESWorldSpace* TraverseAndTranslateWorldspaceChain(RE::TESWorldSpace* a_worldspace, RE::NiPoint3* a_position)
    {
        auto* current = a_worldspace;
        while (current)
        {
            auto* parent = current->GetParentWorld(RE::TESWorldSpace::PARENT_USE_FLAG::kMap);
            if (!parent)
            {
                break;
            }
            if (a_position)
            {
                a_position->x = (a_position->x * current->worldMapOffsetData.mapScale) + current->worldMapOffsetData.mapOffsetX;
                a_position->y = (a_position->y * current->worldMapOffsetData.mapScale) + current->worldMapOffsetData.mapOffsetY;
                a_position->z = (a_position->z * current->worldMapOffsetData.mapScale) + current->worldMapOffsetData.mapOffsetZ;
            }
            current = parent;
        }
        return current;
    }
}

namespace MAP76::Engine
{
    MapBoundsData GetWorldspaceBounds(RE::TESWorldSpace* a_worldspace)
    {
        MapBoundsData bounds{
            Constants::Map::DEFAULT_BOUNDS_MIN_X,
            Constants::Map::DEFAULT_BOUNDS_MAX_X,
            Constants::Map::DEFAULT_BOUNDS_MIN_Y,
            Constants::Map::DEFAULT_BOUNDS_MAX_Y};

        if (a_worldspace)
        {
            auto *mapData = reinterpret_cast<RE::WORLD_MAP_DATA *>(&a_worldspace->worldMapData);
            if (mapData)
            {
                bounds.nwCellX = mapData->nwCellX;
                bounds.nwCellY = mapData->nwCellY;
                bounds.seCellX = mapData->seCellX;
                bounds.seCellY = mapData->seCellY;
                bounds.usableWidth = mapData->usableWidth;
                bounds.usableHeight = mapData->usableHeight;
                bounds.minX = static_cast<float>(mapData->nwCellX) * Constants::Map::CELL_SIZE_UNITS;
                bounds.maxY = static_cast<float>(mapData->nwCellY) * Constants::Map::CELL_SIZE_UNITS;
                bounds.maxX = static_cast<float>(mapData->seCellX) * Constants::Map::CELL_SIZE_UNITS;
                bounds.minY = static_cast<float>(mapData->seCellY) * Constants::Map::CELL_SIZE_UNITS;
            }

            auto *offsetData = &a_worldspace->worldMapOffsetData;
            if (offsetData)
            {
                bounds.mapScale = offsetData->mapScale;
                bounds.mapOffsetX = offsetData->mapOffsetX;
                bounds.mapOffsetY = offsetData->mapOffsetY;
                bounds.mapOffsetZ = offsetData->mapOffsetZ;
            }
        }

        return bounds;
    }

    MapBoundsData GetEngineMapBounds()
    {
        auto *player = RE::PlayerCharacter::GetSingleton();
        if (!player)
        {
            return MapBoundsData{
                Constants::Map::DEFAULT_BOUNDS_MIN_X,
                Constants::Map::DEFAULT_BOUNDS_MAX_X,
                Constants::Map::DEFAULT_BOUNDS_MIN_Y,
                Constants::Map::DEFAULT_BOUNDS_MAX_Y};
        }

        auto *currentWorld = GetReferenceWorldspace(player);
        return GetWorldspaceBounds(currentWorld);
    }

    RE::TESWorldSpace *GetReferenceWorldspace(RE::TESObjectREFR *a_refr, RE::NiPoint3* a_position, bool* a_isDoor)
    {
        if (!a_refr)
        {
            return nullptr;
        }

        auto* world = GetDirectWorldspace(a_refr);
        if (!world)
        {
            world = ResolveInteriorWorldspace(a_refr, a_position, a_isDoor);
        }

        if (world)
        {
            world = TraverseAndTranslateWorldspaceChain(world, a_position);
        }

        return world;
    }

    RE::TESObjectREFR *GetWorldLocationMarker(RE::TESObjectREFR *a_refr)
    {
        if (!a_refr)
        {
            return nullptr;
        }

        auto *cell = a_refr->GetParentCell();
        if (!cell)
        {
            cell = a_refr->GetSaveParentCell();
        }

        if (cell)
        {
            if (auto *location = cell->GetLocation())
            {
                auto *currentLoc = location;
                while (currentLoc)
                {
                    auto markerHandle = currentLoc->worldLocMarker;
                    if (markerHandle)
                    {
                        if (auto markerRef = markerHandle.get())
                        {
                            return markerRef.get();
                        }
                    }
                    currentLoc = currentLoc->parentLoc;
                }
            }
        }

        return nullptr;
    }

    bool IsMarkerLinkedToQuest(RE::PipboyObject *a_markerObj, uint32_t a_questFormID)
    {
        if (!a_markerObj || a_questFormID == 0)
        {
            return false;
        }

        uint32_t singleID = PipboyUtils::GetPipboyUint32(a_markerObj, "formID", PipboyUtils::GetPipboyUint32(a_markerObj, "questID", 0));
        if (singleID != 0 && singleID == a_questFormID)
        {
            return true;
        }

        RE::PipboyArray *qIdArray = GetQuestIdMember(a_markerObj);
        if (qIdArray && !qIdArray->elements.empty())
        {
            for (auto *innerElement : qIdArray->elements)
            {
                if (innerElement && (innerElement->GetType() == RE::PipboyValue::kUint32 || innerElement->GetType() == RE::PipboyValue::kInt32))
                {
                    auto formID = *reinterpret_cast<uint32_t *>(reinterpret_cast<uintptr_t>(innerElement) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
                    if (formID == a_questFormID)
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    std::unordered_map<uint32_t, std::unordered_map<uint32_t, std::vector<GatewayMarker>>> BuildGatewayGraph()
    {
        std::unordered_map<uint32_t, std::unordered_map<uint32_t, std::vector<GatewayMarker>>> graph;
        auto dataHandler = RE::TESDataHandler::GetSingleton();
        if (!dataHandler) return graph;

        std::unordered_map<uint32_t, std::vector<std::pair<uint32_t, GatewayMarker>>> interiorLinks;

        for (auto* world : dataHandler->GetFormArray<RE::TESWorldSpace>())
        {
            if (!world) continue;
            for (auto* door : world->teleportDoorCache)
            {
                if (door && door->extraList)
                {
                    if (auto* extraTeleport = door->extraList->GetByType<RE::ExtraTeleport>())
                    {
                        if (extraTeleport->teleportData && extraTeleport->teleportData->linkedDoor.get_handle() != 0)
                        {
                            auto linkedHandle = extraTeleport->teleportData->linkedDoor;
                            RE::TESObjectREFR* destDoor = nullptr;
                            if (auto ptr = linkedHandle.get()) destDoor = ptr.get();
                            if (!destDoor) destDoor = RE::TESForm::GetFormByID<RE::TESObjectREFR>(linkedHandle.get_handle());

                            if (destDoor)
                            {
                                auto* destWorld = GetDirectWorldspace(destDoor);
                                auto pos = door->GetPosition();
                                GatewayMarker marker{ pos.x, pos.y };

                                if (destWorld)
                                {
                                    if (destWorld->formID != world->formID) {
                                        graph[world->formID][destWorld->formID].push_back(marker);
                                    }
                                }
                                else if (auto* parentCell = destDoor->GetParentCell())
                                {
                                    interiorLinks[parentCell->formID].push_back({ world->formID, marker });
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const auto& [cellId, links] : interiorLinks)
        {
            for (size_t i = 0; i < links.size(); ++i)
            {
                for (size_t j = 0; j < links.size(); ++j)
                {
                    if (i == j) continue;
                    uint32_t worldA = links[i].first;
                    uint32_t worldB = links[j].first;
                    if (worldA != worldB)
                    {
                        graph[worldA][worldB].push_back(links[i].second);
                    }
                }
            }
        }

        return graph;
    }
}
