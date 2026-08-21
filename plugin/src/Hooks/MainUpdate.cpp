#include "PCH.h"
#include "Hooks/MainUpdate.h"
#include "UI/Interop.h"
#include "UI/Payload.h"
#include <nlohmann/json.hpp>
#include <chrono>

namespace MAP76::Hooks
{
    namespace
    {
        void OnFrameTick()
        {
            if (!MAP76::UI::State::g_mapIsOpen.load())
            {
                return;
            }

            if (!MAP76::UI::State::g_api || !MAP76::UI::State::g_view)
            {
                return;
            }

            static auto lastTick = std::chrono::steady_clock::now();
            auto now = std::chrono::steady_clock::now();
            if (std::chrono::duration_cast<std::chrono::milliseconds>(now - lastTick).count() < 500)
            {
                return;
            }
            lastTick = now;

            std::string payloadStr = MAP76::UI::Payload::GetFrameTickPayloadAsJSON();
            if (!payloadStr.empty() && payloadStr != "{}")
            {
                MAP76::UI::State::g_api->InteropCall(MAP76::UI::State::g_view, "onFrameTick", payloadStr.c_str());
            }
        }
    }

    void InstallMainUpdateHook()
    {
        if (auto *taskInterface = F4SE::GetTaskInterface())
        {
            REX::INFO("MAP76: Registering permanent frame tick task...");
            taskInterface->AddTaskPermanent(OnFrameTick);
        }
        else
        {
            REX::ERROR("MAP76: Failed to acquire F4SE TaskInterface for frame tick task!");
        }
    }
}
