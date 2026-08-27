#include "PCH.h"
#include "Hooks/MainUpdate.h"
#include "UI/Interop.h"
#include "UI/Payload.h"
#include <nlohmann/json.hpp>
#include <chrono>
#include <thread>

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
            REX::INFO("MAP76: Registering background thread for frame tick...");
            std::thread([]() {
                while (true) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(500));
                    if (MAP76::UI::State::g_mapIsOpen.load()) {
                        if (auto *taskInt = F4SE::GetTaskInterface()) {
                            taskInt->AddTask(OnFrameTick);
                        }
                    }
                }
            }).detach();
        }
        else
        {
            REX::ERROR("MAP76: Failed to acquire F4SE TaskInterface for frame tick task!");
        }
    }
}
