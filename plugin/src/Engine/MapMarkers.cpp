#include "PCH.h"
#include <optional>
#include "Engine/MapMarkers.h"
#include "Engine/Memory.h"
#include "Engine/MapData.h"
#include "Constants.h"
#include "RE/T/TESDataHandler.h"
#include "RE/T/TESWorldSpace.h"
#include "RE/T/TESObjectCELL.h"
namespace
{
    std::optional<MAP76::Engine::MapMarkers::MarkerData> TryCollectMarker(RE::TESObjectREFR* a_refr)
    {
        if (!a_refr || !MAP76::Engine::Memory::IsReferenceSafe(a_refr))
        {
            return std::nullopt;
        }

        if (a_refr->IsDisabled() || a_refr->IsDeleted())
        {
            return std::nullopt;
        }

        auto *dataList = a_refr->extraList.get();
        auto *extraData = dataList ? dataList->GetByType<RE::ExtraMapMarker>() : nullptr;
        if (!extraData || !extraData->mapMarkerData)
        {
            return std::nullopt;
        }

        auto *markerData = extraData->mapMarkerData;

        uint8_t rawFlags = *reinterpret_cast<uint8_t *>(reinterpret_cast<char *>(markerData) + MAP76::Constants::Marker::FLAGS_OFFSET);
        
        auto iconTypeOpt = MAP76::Engine::MapMarkers::GetMarkerIconType(a_refr);
        if (!iconTypeOpt)
        {
            return std::nullopt;
        }
        uint16_t iconTypeNumber = *iconTypeOpt;

        std::string markerName;
        auto *fullNameInterface = reinterpret_cast<RE::TESFullName *>(markerData);
        if (fullNameInterface)
        {
            markerName = fullNameInterface->GetFullName();
        }

        if (markerName.empty())
        {
            markerName = a_refr->GetDisplayFullName();
        }

        RE::NiPoint3 markerPosition = a_refr->GetPosition();
        auto *markerWorld = MAP76::Engine::GetReferenceWorldspace(a_refr, &markerPosition);

        MAP76::Engine::MapMarkers::MarkerData markerElement{};
        markerElement.formId = a_refr->formID;
        if (auto* file = a_refr->GetFile(0)) {
            markerElement.pluginName = file->GetFilename();
        }
        markerElement.localFormId = a_refr->GetLocalFormID();
        markerElement.name = markerName;
        markerElement.iconType = iconTypeNumber;
        markerElement.visible = (rawFlags & MAP76::Constants::Marker::FLAG_VISIBLE) != 0;
        markerElement.canFastTravel = (rawFlags & MAP76::Constants::Marker::FLAG_FAST_TRAVEL) != 0;
        markerElement.discovered = (rawFlags & MAP76::Constants::Marker::FLAG_DISCOVERED) != 0;
        markerElement.worldspace = markerWorld ? markerWorld->formID : 0;
        markerElement.position = markerPosition;

        return markerElement;
    }
}

namespace MAP76::Engine::MapMarkers
{
    std::vector<MarkerData> CollectAll(RE::PipboyDataManager *a_pipboyManager)
    {
        std::vector<MarkerData> markers;

        auto dataHandler = RE::TESDataHandler::GetSingleton();
        if (!dataHandler)
        {
            return markers;
        }

        for (auto* world : dataHandler->GetFormArray<RE::TESWorldSpace>())
        {
            if (!world || !world->persistentCell)
            {
                continue;
            }

            for (auto& refPtr : world->persistentCell->references)
            {
                if (auto* refr = refPtr.get())
                {
                    if (auto markerData = TryCollectMarker(refr))
                    {
                        if (!markerData->name.empty() && markerData->name != "Marker")
                        {
                            markers.push_back(*markerData);
                        }
                    }
                }
            }
        }

        return markers;
    }

    std::optional<uint16_t> GetMarkerIconType(RE::TESObjectREFR* a_refr)
    {
        if (!a_refr || !MAP76::Engine::Memory::IsReferenceSafe(a_refr))
        {
            return std::nullopt;
        }

        auto *dataList = a_refr->extraList.get();
        auto *extraData = dataList ? dataList->GetByType<RE::ExtraMapMarker>() : nullptr;
        if (!extraData || !extraData->mapMarkerData)
        {
            return std::nullopt;
        }

        uint16_t iconTypeNumber = *reinterpret_cast<uint16_t *>(reinterpret_cast<char *>(extraData->mapMarkerData) + MAP76::Constants::Marker::ICON_OFFSET);

        if (iconTypeNumber == MAP76::Constants::Marker::CUSTOM_PIN_ICON_ID || iconTypeNumber > MAP76::Constants::Marker::MAX_VALID_ICON_ID)
        {
            return std::nullopt;
        }

        return iconTypeNumber;
    }
}
