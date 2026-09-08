#include "PCH.h"
#include "F4SE/API.h"
#include "RE/B/BS_BUTTON_CODE.h"
#include "RE/B/BSFixedString.h"
#include "RE/B/BSInputEventUser.h"
#include "RE/B/ButtonEvent.h"
#include "RE/C/ControlMap.h"
#include "RE/D/DeviceConnectEvent.h"
#include "RE/M/MenuControls.h"
#include "RE/M/MenuOpenHandler.h"
#include "RE/T/ThumbstickEvent.h"
#include "RE/U/UIMessageQueue.h"
#include "RE/U/UserEvents.h"
#include "Hooks/ControllerInput.h"
#include "UI/Interop.h"
#include "UI/Settings.h"
#include <chrono>
#include <cmath>

namespace MAP76::Hooks
{
    using PerformInputProcessing_t = void (*)(RE::MenuControls *, const RE::InputEvent *);
    REL::Relocation<PerformInputProcessing_t> g_originalPerformInputProcessing;

    bool IsGamepadStartEvent(const RE::ButtonEvent *a_event)
    {
        if (a_event->device != RE::INPUT_DEVICE::kGamepad)
        {
            return false;
        }

        if (a_event->QUserEvent() == "Pause")
        {
            return true;
        }

        if (auto *controlMap = RE::ControlMap::GetSingleton())
        {
            auto pauseKey = controlMap->GetMappedKey("Pause", RE::INPUT_DEVICE::kGamepad, RE::UserEvents::INPUT_CONTEXT_ID::kMainGameplay);
            if ((pauseKey != RE::ControlMap::kInvalid && a_event->idCode == pauseKey))
            {
                return true;
            }
        }

        return false;
    }

    void NeuterButtonEvent(const RE::ButtonEvent *a_event)
    {
        auto *mutEvent = const_cast<RE::ButtonEvent *>(a_event);
        mutEvent->value = 0.0f;
        mutEvent->heldDownSecs = 0.0f;
        mutEvent->idCode = -1;
        mutEvent->disabled = true;
    }

    void HandleInterceptedStartButton(const RE::ButtonEvent *a_event)
    {
        if (MAP76::UI::State::g_waitingToOpenPauseMenu.load())
        {
            if (!a_event->QPressed())
            {
                MAP76::UI::State::g_waitingToOpenPauseMenu.store(false);
                if (auto *task = F4SE::GetTaskInterface())
                {
                    task->AddUITask([]()
                    {
                        if (auto *msgQ = RE::UIMessageQueue::GetSingleton())
                        {
                            msgQ->AddMessage(RE::BSFixedString("PauseMenu"), RE::UI_MESSAGE_TYPE::kShow);
                        }
                    });
                }
            }
            NeuterButtonEvent(a_event);
            return;
        }

        bool shouldIntercept = MAP76::UI::State::g_mapIsOpen.load() || !MAP76::UI::IsPlayerInMenuMode();
        if (!shouldIntercept)
        {
            return;
        }

        if (!a_event->QJustPressed())
        {
            NeuterButtonEvent(a_event);
            return;
        }

        if (auto *task = F4SE::GetTaskInterface())
        {
            if (MAP76::UI::State::g_mapIsOpen.load())
            {
                task->AddUITask([]()
                                {
                    if (MAP76::UI::State::g_mapIsOpen.load())
                        MAP76::UI::ToggleMAP76();
                        
                    MAP76::UI::State::g_waitingToOpenPauseMenu.store(true); });
            }
            else
            {
                task->AddUITask([]() { MAP76::UI::ToggleMAP76(); });
            }
        }

        NeuterButtonEvent(a_event);
    }

    bool UpdateGamepadStateFromInput(const RE::InputEvent *a_eventQueue, bool a_currentState)
    {
        bool isGamepad = a_currentState;
        for (auto *event = a_eventQueue; event; event = event->next)
        {
            if (event->eventType == RE::INPUT_EVENT_TYPE::kDeviceConnect)
            {
                auto *connectEvent = static_cast<const RE::DeviceConnectEvent *>(event);
                if (connectEvent->device == RE::INPUT_DEVICE::kGamepad)
                {
                    isGamepad = connectEvent->connected;
                }
            }
            else if (event->eventType != RE::INPUT_EVENT_TYPE::kMouseMove &&
                     event->eventType != RE::INPUT_EVENT_TYPE::kCursorMove)
            {
                if (event->device == RE::INPUT_DEVICE::kGamepad)
                {
                    isGamepad = true;
                }
                else if (event->device == RE::INPUT_DEVICE::kKeyboard || event->device == RE::INPUT_DEVICE::kMouse)
                {
                    isGamepad = false;
                }
            }
        }
        return isGamepad;
    }

    void Hook_PerformInputProcessing(RE::MenuControls *a_this, const RE::InputEvent *a_eventQueue)
    {
        static bool s_lastGamepadState = false;
        bool isGamepad = UpdateGamepadStateFromInput(a_eventQueue, s_lastGamepadState);

        static bool s_wasMapOpen = false;
        bool isMapOpen = MAP76::UI::State::g_mapIsOpen.load();
        bool justOpened = isMapOpen && !s_wasMapOpen;
        if (justOpened || isGamepad != s_lastGamepadState)
        {
            s_lastGamepadState = isGamepad;

            if (isMapOpen && MAP76::UI::State::g_api && MAP76::UI::State::g_view)
            {
                MAP76::UI::State::g_api->Invoke(MAP76::UI::State::g_view, isGamepad ? "window.dispatchEvent(new CustomEvent('gamepadStateChanged', {detail: true}))" : "window.dispatchEvent(new CustomEvent('gamepadStateChanged', {detail: false}))");
            }
        }
        s_wasMapOpen = isMapOpen;

        for (auto *event = a_eventQueue; event; event = event->next)
        {
            if (event->eventType == RE::INPUT_EVENT_TYPE::kButton)
            {
                auto *a_event = static_cast<const RE::ButtonEvent *>(event);
                if (IsGamepadStartEvent(a_event))
                {
                    HandleInterceptedStartButton(a_event);
                }
            }
        }
        g_originalPerformInputProcessing(a_this, a_eventQueue);
    }

    class ControllerThumbstickHandler : public RE::BSInputEventUser
    {
    public:
        static ControllerThumbstickHandler *GetSingleton()
        {
            static ControllerThumbstickHandler singleton;
            return &singleton;
        }

        bool ShouldHandleEvent(const RE::InputEvent *a_event) override
        {
            return true;
        }

        void OnThumbstickEvent(const RE::ThumbstickEvent *a_event) override
        {
            if (!MAP76::UI::State::g_mapIsOpen.load())
                return;
            if (!a_event || a_event->idCode != RE::ThumbstickEvent::kLeft)
                return;

            float x = a_event->xValue;
            float y = a_event->yValue;

            if (std::abs(x) < 0.2f)
                x = 0.0f;
            if (std::abs(y) < 0.2f)
                y = 0.0f;

            if (x == 0.0f && y == 0.0f)
                return;

            static float fracX = 0.0f;
            static float fracY = 0.0f;
            static auto lastTime = std::chrono::steady_clock::now();
            auto now = std::chrono::steady_clock::now();
            float dt = std::chrono::duration<float>(now - lastTime).count();
            lastTime = now;

            if (dt > 0.1f)
                dt = 0.016f;

            POINT beforePt;
            if (!::GetCursorPos(&beforePt))
                return;

            float speed = MAP76::UI::Settings::gamepadCursorSpeed * dt;
            float totalDx = (x * speed) + fracX;
            float totalDy = (y * speed) + fracY;
            int dx = static_cast<int>(totalDx);
            int dy = static_cast<int>(totalDy);
            fracX = totalDx - dx;
            fracY = totalDy - dy;

            ::SetCursorPos(beforePt.x + dx, beforePt.y - dy);

            POINT afterPt;
            if (!::GetCursorPos(&afterPt))
                return;

            int leftoverX = dx - (afterPt.x - beforePt.x);
            int leftoverY = -dy - (afterPt.y - beforePt.y);

            if (leftoverX != 0 || leftoverY != 0)
            {
                char buffer[128];
                snprintf(buffer, sizeof(buffer),
                         "if (window.__panViewport) { window.__panViewport(%f, %f); }",
                         (float)-leftoverX * MAP76::UI::Settings::gamepadPanSensitivity,
                         (float)-leftoverY * MAP76::UI::Settings::gamepadPanSensitivity);
                if (MAP76::UI::State::g_api && MAP76::UI::State::g_view)
                {
                    MAP76::UI::State::g_api->Invoke(MAP76::UI::State::g_view, buffer);
                }
            }
        }
    };

    void ControllerInput::Register()
    {
        auto *menuControls = RE::MenuControls::GetSingleton();
        if (!menuControls)
            return;

        REX::INFO("MAP76: Hooking MenuControls::PerformInputProcessing...");
        REL::Relocation<uintptr_t> vtable{*reinterpret_cast<uintptr_t *>(menuControls)};
        g_originalPerformInputProcessing = vtable.write_vfunc(0x0, Hook_PerformInputProcessing);

        menuControls->handlers.insert(menuControls->handlers.begin(), ControllerThumbstickHandler::GetSingleton());
    }
}
