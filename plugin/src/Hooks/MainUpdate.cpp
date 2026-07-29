#include "PCH.h"
#include "Hooks/MainUpdate.h"
#include "UI/Interop.h"
#include <nlohmann/json.hpp>

namespace PaperMap::Hooks
{
    namespace
    {
        void OnFrameTick()
        {
            if (!PaperMap::UI::State::g_mapIsOpen.load())
            {
                return;
            }

            if (!PaperMap::UI::State::g_api || !PaperMap::UI::State::g_view)
            {
                return;
            }

            auto *calendar = RE::Calendar::GetSingleton();
            if (!calendar)
            {
                return;
            }

            if (!calendar->gameHour || !calendar->gameDay || !calendar->gameMonth || !calendar->gameYear)
            {
                return;
            }

            float hour = calendar->gameHour->value;
            float day = calendar->gameDay->value;
            float month = calendar->gameMonth->value;
            float year = calendar->gameYear->value + 2000;

            nlohmann::json tickPayload;
            tickPayload["hour"] = hour;
            tickPayload["day"] = day;
            tickPayload["month"] = month;
            tickPayload["year"] = year;

            std::string payloadStr = tickPayload.dump();
            PaperMap::UI::State::g_api->InteropCall(PaperMap::UI::State::g_view, "onFrameTick", payloadStr.c_str());
        }
    }

    void InstallMainUpdateHook()
    {
        if (auto *taskInterface = F4SE::GetTaskInterface())
        {
            REX::INFO("f4map: Registering permanent frame tick task...");
            taskInterface->AddTaskPermanent(OnFrameTick);
        }
        else
        {
            REX::ERROR("f4map: Failed to acquire F4SE TaskInterface for frame tick task!");
        }
    }
}
