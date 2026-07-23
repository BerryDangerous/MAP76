#include "PCH.h"
#include "Engine/MapData.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Constants.h"

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
            if (PaperMap::Engine::Memory::IsValidWorldspace(cell->worldSpace))
            {
                return cell->worldSpace;
            }
        }

        if (auto* cell = a_refr->GetSaveParentCell())
        {
            if (PaperMap::Engine::Memory::IsValidWorldspace(cell->worldSpace))
            {
                return cell->worldSpace;
            }
        }

        return nullptr;
    }

    RE::TESWorldSpace* ResolveInteriorFallback(RE::TESObjectREFR* a_refr, RE::NiPoint3* a_position)
    {
        if (a_refr->formID == PaperMap::Constants::FormID::PLAYER)
        {
            auto* pipboyManager = RE::PipboyDataManager::GetSingleton();
            if (pipboyManager && a_position)
            {
                *a_position = pipboyManager->mapData.playerLastWorldPosition;
            }
        }

        if (auto* cell = a_refr->GetParentCell())
        {
            if (auto* location = cell->GetLocation())
            {
                auto* currentLoc = location;
                while (currentLoc)
                {
                    auto markerHandle = currentLoc->worldLocMarker;
                    if (markerHandle)
                    {
                        auto markerRef = markerHandle.get();
                        if (markerRef)
                        {
                            auto* cellWorld = GetDirectWorldspace(markerRef.get());
                            if (cellWorld)
                            {
                                return cellWorld;
                            }
                        }
                    }
                    currentLoc = currentLoc->parentLoc;
                }
            }
        }

        auto* tes = RE::TES::GetSingleton();
        if (tes && tes->worldSpace)
        {
            return tes->worldSpace;
        }

        auto* form = RE::TESForm::GetFormByID(PaperMap::Constants::FormID::COMMONWEALTH);
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

namespace PaperMap::Engine
{
    MapBoundsData GetEngineMapBounds()
    {
        MapBoundsData bounds{
            Constants::Map::DEFAULT_BOUNDS_MIN_X,
            Constants::Map::DEFAULT_BOUNDS_MAX_X,
            Constants::Map::DEFAULT_BOUNDS_MIN_Y,
            Constants::Map::DEFAULT_BOUNDS_MAX_Y};

        auto *player = RE::PlayerCharacter::GetSingleton();
        if (!player)
        {
            return bounds;
        }

        auto *currentWorld = GetReferenceWorldspace(player);
        if (currentWorld)
        {
            auto *mapData = reinterpret_cast<RE::WORLD_MAP_DATA *>(&currentWorld->worldMapData);
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

            auto *offsetData = &currentWorld->worldMapOffsetData;
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

    RE::TESWorldSpace *GetReferenceWorldspace(RE::TESObjectREFR *a_refr, RE::NiPoint3* a_position)
    {
        if (!a_refr)
        {
            return nullptr;
        }

        auto* world = GetDirectWorldspace(a_refr);
        if (!world)
        {
            world = ResolveInteriorFallback(a_refr, a_position);
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

    uint32_t GetQuestFormIDFromMarker(RE::PipboyObject *a_markerObj)
    {
        if (!a_markerObj)
        {
            return 0;
        }

        RE::PipboyArray *qIdArray = GetQuestIdMember(a_markerObj);
        if (qIdArray && !qIdArray->elements.empty())
        {
            RE::PipboyValue *innerElement = qIdArray->elements[0];
            if (innerElement && (innerElement->GetType() == RE::PipboyValue::kUint32 || innerElement->GetType() == RE::PipboyValue::kInt32))
            {
                auto formID = *reinterpret_cast<uint32_t *>(reinterpret_cast<uintptr_t>(innerElement) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
                return formID;
            }
        }

        return 0;
    }
}
