#include "PCH.h"
#include "Engine/WorkshopManager.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Engine/MapData.h"
#include "Engine/MapMarkers.h"
#include "Constants.h"
#include "UI/Settings.h"

#include "RE/A/Actor.h"
#include "RE/B/BGSKeyword.h"
#include "RE/B/BGSKeywordForm.h"
#include "RE/B/BGSLocation.h"
#include "RE/D/DoorTeleportData.h"
#include "RE/T/TESQuest.h"

namespace MAP76::Engine::WorkshopManager
{
    namespace
    {
        using LocationLinkMap = std::unordered_map<uint32_t, std::vector<uint32_t>>;

        uint32_t GetLocationIdFromReference(RE::TESObjectREFR *reference)
        {
            if (!reference || !Memory::IsReferenceSafe(reference))
                return 0;

            if (auto *location = reference->GetCurrentLocation())
                return location->formID;

            if (reference->extraList)
            {
                if (auto *extraLoc = reference->extraList->GetByType<RE::ExtraLocation>())
                {
                    if (extraLoc->location)
                        return extraLoc->location->formID;
                }
            }

            return 0;
        }

        void AddUniqueLink(LocationLinkMap &linkMap, uint32_t locationA, uint32_t locationB)
        {
            if (locationA == 0 || locationB == 0 || locationA == locationB)
                return;

            auto insertIfUnique = [](std::vector<uint32_t> &list, uint32_t id)
            {
                if (std::find(list.begin(), list.end(), id) == list.end())
                {
                    list.push_back(id);
                }
            };

            insertIfUnique(linkMap[locationA], locationB);
            insertIfUnique(linkMap[locationB], locationA);
        }

        void AddUniqueId(std::vector<uint32_t> &list, uint32_t id)
        {
            if (id != 0 && std::find(list.begin(), list.end(), id) == list.end())
            {
                list.push_back(id);
            }
        }

        SettlementData ToSettlementData(const RawWorkshopData &raw)
        {
            return SettlementData{
                .formId = raw.formId,
                .locationFormId = raw.locationFormId,
                .markerFormId = raw.markerFormId,
                .iconType = raw.iconType,
                .worldspace = raw.worldspace,
                .name = raw.name,
                .owned = raw.isOwned,
                .raider = raw.isRaider,
                .vassal = raw.isVassal,
                .excludedFromVassal = raw.isExcludedFromVassal,
                .vr = raw.isVR,
                .population = raw.population,
                .happiness = raw.happiness,
                .food = raw.food,
                .water = raw.water,
                .power = raw.power,
                .defense = raw.defense,
                .beds = raw.beds,
                .linkedLocationFormIds = raw.linkedLocationIds};
        }

        LocationLinkMap CollectSupplyLines()
        {
            LocationLinkMap supplyLines;

            auto *caravanStartKw = RE::TESForm::GetFormByEditorID<RE::BGSKeyword>(Constants::Workshop::KEYWORD_CARAVAN_START);
            auto *caravanEndKw = RE::TESForm::GetFormByEditorID<RE::BGSKeyword>(Constants::Workshop::KEYWORD_CARAVAN_END);

            if (!caravanStartKw || !caravanEndKw)
            {
                if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] Caravan keywords not found — skipping supply lines collection.");
                return supplyLines;
            }

            auto *parentQuest = RE::TESForm::GetFormByID<RE::TESQuest>(Constants::Workshop::WORKSHOP_PARENT_QUEST_FORM_ID);
            if (!parentQuest)
            {
                if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] WorkshopParent quest 0x{:08X} not found.", Constants::Workshop::WORKSHOP_PARENT_QUEST_FORM_ID);
                return supplyLines;
            }

            size_t resolvedCount = 0;
            for (const auto &handleArray : parentQuest->aliasedHandles)
            {
                for (const auto &handle : handleArray)
                {
                    auto reference = handle.get();
                    if (!reference || !Memory::IsReferenceSafe(reference.get()))
                        continue;

                    auto *startRef = reference->GetLinkedRef(caravanStartKw);
                    auto *endRef = reference->GetLinkedRef(caravanEndKw);
                    if (!startRef || !endRef)
                        continue;

                    uint32_t locA = GetLocationIdFromReference(startRef);
                    uint32_t locB = GetLocationIdFromReference(endRef);
                    if (locA && locB && locA != locB)
                    {
                        AddUniqueLink(supplyLines, locA, locB);
                        ++resolvedCount;
                    }
                }
            }

            if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] Resolved {} active supply lines.", resolvedCount);
            return supplyLines;
        }

        PipboyMarkerIndex BuildPipboyMarkerIndex(RE::PipboyDataManager *manager)
        {
            PipboyMarkerIndex index;
            if (!manager || !manager->mapData.mapObject)
                return index;

            auto *locationsArray = PipboyUtils::GetPipboyArray(manager->mapData.mapObject, "Locations");
            if (!locationsArray)
                return index;

            for (auto *element : locationsArray->elements)
            {
                if (!element || element->GetType() != RE::PipboyValue::kObject)
                    continue;
                auto *pipboyObject = reinterpret_cast<RE::PipboyObject *>(element);

                uint32_t locationId = PipboyUtils::GetPipboyUint32(pipboyObject, "LocationFormId", 0);
                if (locationId == 0)
                    locationId = PipboyUtils::GetPipboyUint32(pipboyObject, "locationID", 0);
                if (locationId)
                    index.locationsByLocationId[locationId] = pipboyObject;

                uint32_t markerId = PipboyUtils::GetPipboyUint32(pipboyObject, "LocationMarkerFormId", 0);
                if (markerId == 0)
                    markerId = PipboyUtils::GetPipboyUint32(pipboyObject, "mapMarkerID", 0);
                if (markerId)
                    index.locationsByMarkerId[markerId] = pipboyObject;
            }

            return index;
        }

        void ExtractWorkshopStats(RE::PipboyObject *workshopObject, RawWorkshopData &rawData)
        {
            rawData.name = PipboyUtils::GetPipboyString(workshopObject, "name", "Workshop");
            rawData.isOwned = PipboyUtils::GetPipboyBool(workshopObject, "owned", false);
            rawData.isRaider = PipboyUtils::GetPipboyBool(workshopObject, "raider", false);

            uint32_t markerId = PipboyUtils::GetPipboyUint32(workshopObject, "mapMarkerID", 0);
            if (markerId == 0)
                markerId = PipboyUtils::GetPipboyUint32(workshopObject, "LocationMarkerFormId", 0);
            if (markerId)
                rawData.markerFormId = markerId;

            if (auto *statsArray = PipboyUtils::GetPipboyArray(workshopObject, "workshopData"))
            {
                const auto &elements = statsArray->elements;
                if (elements.size() > 0)
                    rawData.population = static_cast<uint32_t>(PipboyUtils::ExtractNumericValue(elements[0]));
                if (elements.size() > 1)
                    rawData.food = PipboyUtils::ExtractNumericValue(elements[1]);
                if (elements.size() > 2)
                    rawData.water = PipboyUtils::ExtractNumericValue(elements[2]);
                if (elements.size() > 3)
                    rawData.power = PipboyUtils::ExtractNumericValue(elements[3]);
                if (elements.size() > 4)
                    rawData.defense = PipboyUtils::ExtractNumericValue(elements[4]);
                if (elements.size() > 5)
                    rawData.beds = PipboyUtils::ExtractNumericValue(elements[5]);
                if (elements.size() > 6)
                    rawData.happiness = static_cast<uint32_t>(PipboyUtils::ExtractNumericValue(elements[6]));
            }
        }

        bool ResolveReferenceAndLocation(uint32_t workshopFormId, RawWorkshopData &rawData)
        {
            auto *form = RE::TESForm::GetFormByID(workshopFormId);
            if (!form)
                return false;

            if (form->formType.get() == RE::ENUM_FORM_ID::kREFR)
            {
                rawData.workshopRef = form->As<RE::TESObjectREFR>();
            }
            else if (form->formType.get() == RE::ENUM_FORM_ID::kLCTN)
            {
                rawData.locationFormId = form->formID;
                return true;
            }
            else
            {
                return false;
            }

            if (!rawData.workshopRef || !Memory::IsReferenceSafe(rawData.workshopRef))
                return false;

            if (auto *cell = rawData.workshopRef->GetParentCell())
            {
                rawData.isInterior = cell->IsInterior();
            }

            if (auto *world = MAP76::Engine::GetReferenceWorldspace(rawData.workshopRef))
            {
                rawData.worldspace = world->formID;
            }

            rawData.locationFormId = GetLocationIdFromReference(rawData.workshopRef);
            return true;
        }

        bool ResolveMarkerFromLocationHierarchy(RawWorkshopData &rawData)
        {
            if (rawData.location)
            {
                if (const char *locationName = rawData.location->GetFullName(); locationName && *locationName != '\0')
                {
                    rawData.name = locationName;
                }
            }

            if (rawData.markerFormId != 0)
                return true;

            if (rawData.workshopRef)
            {
                if (auto *markerRef = MAP76::Engine::GetWorldLocationMarker(rawData.workshopRef))
                {
                    rawData.markerFormId = markerRef->formID;

                    if (rawData.worldspace == 0)
                    {
                        if (auto *markerWorld = MAP76::Engine::GetReferenceWorldspace(markerRef))
                        {
                            rawData.worldspace = markerWorld->formID;
                        }
                    }
                    return true;
                }
            }

            return false;
        }

        void MergePipboyLinkedLocations(RE::PipboyObject *travelObject, RawWorkshopData &rawData)
        {
            if (!travelObject)
                return;

            if (rawData.locationFormId == 0)
            {
                uint32_t locId = PipboyUtils::GetPipboyUint32(travelObject, "LocationFormId", 0);
                if (locId == 0)
                    locId = PipboyUtils::GetPipboyUint32(travelObject, "locationID", 0);
                rawData.locationFormId = locId;
            }

            uint32_t markerId = PipboyUtils::GetPipboyUint32(travelObject, "LocationMarkerFormId", 0);
            if (markerId == 0)
                markerId = PipboyUtils::GetPipboyUint32(travelObject, "mapMarkerID", 0);
            if (markerId && rawData.markerFormId == 0)
                rawData.markerFormId = markerId;

            static constexpr std::array<const char *, 5> linkedKeys = {
                "WorkshopLinkedLocs", "workshopLinkedLocs", "LinkedLocations",
                "WorkshopLinkedLocations", "LinkedLocs"};

            for (const char *key : linkedKeys)
            {
                if (auto *array = PipboyUtils::GetPipboyArray(travelObject, key))
                {
                    for (auto *element : array->elements)
                    {
                        if (!element)
                            continue;
                        uint32_t locId = static_cast<uint32_t>(PipboyUtils::ExtractNumericValue(element));
                        AddUniqueId(rawData.linkedLocationIds, locId);
                    }
                    break;
                }
            }
        }

        void EvaluateLocationKeywords(RawWorkshopData &rawData)
        {
            if (!rawData.location)
                return;

            rawData.isSettlement = rawData.location->HasKeywordString(Constants::Workshop::KEYWORD_SETTLEMENT.data());
            rawData.isRaider = rawData.location->HasKeywordString(Constants::Workshop::KEYWORD_RAIDER_SETTLEMENT.data());
            rawData.isVassal = rawData.location->HasKeywordString(Constants::Workshop::KEYWORD_VASSAL_SETTLEMENT.data());
            rawData.isExcludedFromVassal = rawData.location->HasKeywordString(Constants::Workshop::KEYWORD_VASSAL_EXCLUDED.data());
            rawData.isVR = rawData.location->HasKeywordString(Constants::Workshop::KEYWORD_VR_WORKSHOP.data());

            if (!rawData.isVassal || !rawData.isRaider)
            {
                for (const auto &keywordData : rawData.location->keywordData)
                {
                    if (!keywordData.keyword)
                        continue;
                    const char *editorId = keywordData.keyword->GetFormEditorID();
                    if (!editorId || *editorId == '\0')
                        continue;

                    if (Constants::Workshop::KEYWORD_VASSAL_SETTLEMENT == editorId && keywordData.data > 0.0f)
                    {
                        rawData.isVassal = true;
                    }
                    if (Constants::Workshop::KEYWORD_RAIDER_SETTLEMENT == editorId && keywordData.data > 0.0f)
                    {
                        rawData.isRaider = true;
                    }
                }
            }
        }
    }

    std::optional<float> GetVassalDistanceGlobal()
    {
        if (auto *global = RE::TESForm::GetFormByEditorID<RE::TESGlobal>(Constants::Workshop::GLOBAL_DLC04_RAID_VASSAL_DISTANCE.data()))
        {
            return global->value;
        }
        return std::nullopt;
    }

    std::vector<SettlementData> CollectAllWorkshops(RE::PipboyDataManager *pipboyManager)
    {
        std::vector<SettlementData> result;
        if (!pipboyManager)
            return result;

        LocationLinkMap supplyLines = CollectSupplyLines();
        PipboyMarkerIndex pipboyIndex = BuildPipboyMarkerIndex(pipboyManager);

        const auto &workshopMap = pipboyManager->workshopData.workshopMap;
        if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] Processing {} workshops from Pipboy map.", workshopMap.size());

        for (const auto &[workshopFormId, workshopObject] : workshopMap)
        {
            if (!workshopObject)
                continue;

            RawWorkshopData rawData{.formId = workshopFormId};
            ExtractWorkshopStats(workshopObject, rawData);

            if (!ResolveReferenceAndLocation(workshopFormId, rawData))
            {
                if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] FILTERED 0x{:08X} '{}' — could not resolve REFR or location form", workshopFormId, rawData.name);
                continue;
            }

            if (rawData.locationFormId != 0)
            {
                rawData.location = RE::TESForm::GetFormByID<RE::BGSLocation>(rawData.locationFormId);
            }

            bool hasMarker = ResolveMarkerFromLocationHierarchy(rawData);
            if (!hasMarker && rawData.locationFormId != 0)
            {
                if (auto it = pipboyIndex.locationsByLocationId.find(rawData.locationFormId); it != pipboyIndex.locationsByLocationId.end() && it->second)
                {
                    uint32_t markerId = PipboyUtils::GetPipboyUint32(it->second, "LocationMarkerFormId", 0);
                    if (markerId == 0)
                        markerId = PipboyUtils::GetPipboyUint32(it->second, "mapMarkerID", 0);
                    if (markerId != 0)
                    {
                        rawData.markerFormId = markerId;
                        hasMarker = true;
                    }
                }
            }

            if (!hasMarker)
            {
                if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] FILTERED 0x{:08X} '{}' (Loc: 0x{:08X}) — no map marker found", workshopFormId, rawData.name, rawData.locationFormId);
                continue;
            }

            {
                RE::PipboyObject *travelObject = nullptr;
                if (rawData.markerFormId)
                {
                    if (auto it = pipboyIndex.locationsByMarkerId.find(rawData.markerFormId); it != pipboyIndex.locationsByMarkerId.end())
                        travelObject = it->second;
                }
                if (!travelObject && rawData.locationFormId)
                {
                    if (auto it = pipboyIndex.locationsByLocationId.find(rawData.locationFormId); it != pipboyIndex.locationsByLocationId.end())
                        travelObject = it->second;
                }
                MergePipboyLinkedLocations(travelObject, rawData);
            }

            if (rawData.locationFormId != 0)
            {
                if (auto it = supplyLines.find(rawData.locationFormId); it != supplyLines.end())
                {
                    for (uint32_t targetLocId : it->second)
                    {
                        AddUniqueId(rawData.linkedLocationIds, targetLocId);
                    }
                }
            }

            if (rawData.markerFormId != 0)
            {
                if (auto *markerRef = RE::TESForm::GetFormByID<RE::TESObjectREFR>(rawData.markerFormId))
                {
                    if (rawData.worldspace == 0)
                    {
                        auto position = markerRef->GetPosition();
                        if (auto *markerWorld = GetReferenceWorldspace(markerRef, &position))
                        {
                            rawData.worldspace = markerWorld->formID;
                        }
                    }

                    if (auto iconTypeOpt = MAP76::Engine::MapMarkers::GetMarkerIconType(markerRef))
                    {
                        rawData.iconType = *iconTypeOpt;
                    }
                }
            }

            EvaluateLocationKeywords(rawData);

            if (rawData.isSettlement)
            {
                result.push_back(ToSettlementData(rawData));
            }
            else
            {
                if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] FILTERED 0x{:08X} '{}' — no settlement keyword", workshopFormId, rawData.name);
            }
        }

        if (MAP76::UI::Settings::showWorkshopInfoLog) REX::INFO("[WorkshopManager] Collection completed: {} settlements.", result.size());
        return result;
    }
}
