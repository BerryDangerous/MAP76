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

    namespace
    {
        struct StartHoldState
        {
            bool active{false};
            bool openedMap{false};
            std::chrono::steady_clock::time_point pressedAt{};

            void Reset() noexcept
            {
                active = false;
                openedMap = false;
            }
        };

        StartHoldState g_startHoldState;

        void QueueOpenPauseMenu()
        {
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
    }

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

    bool HandleActiveStartHold(const RE::ButtonEvent *a_event)
    {
        if (!g_startHoldState.active)
        {
            return false;
        }

        if (!a_event->QPressed())
        {
            const bool alreadyOpenedMap = g_startHoldState.openedMap;
            g_startHoldState.Reset();
            if (!alreadyOpenedMap && !MAP76::UI::State::g_mapIsOpen.load() && !MAP76::UI::IsPlayerInMenuMode())
            {
                QueueOpenPauseMenu();
            }
            NeuterButtonEvent(a_event);
            return true;
        }

        if (a_event->QJustPressed())
        {
            // Missed the previous release event; clear stale hold and evaluate as a fresh press.
            g_startHoldState.Reset();
            return false;
        }

        if (!g_startHoldState.openedMap)
        {
            if (MAP76::UI::State::g_mapIsOpen.load() || MAP76::UI::IsPlayerInMenuMode() || !MAP76::UI::CanOpenPipboyMap())
            {
                g_startHoldState.Reset();
            }
            else
            {
                const float holdSeconds = MAP76::UI::Settings::gamepadMapHoldSeconds > 0.0f
                    ? MAP76::UI::Settings::gamepadMapHoldSeconds
                    : 0.0f;
                const float elapsedSecs = std::chrono::duration<float>(
                    std::chrono::steady_clock::now() - g_startHoldState.pressedAt).count();
                if (elapsedSecs >= holdSeconds)
                {
                    g_startHoldState.openedMap = true;
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddUITask([]()
                        {
                            if (!MAP76::UI::State::g_mapIsOpen.load())
                            {
                                MAP76::UI::ToggleMAP76();
                            }
                        });
                    }
                }
            }
        }

        NeuterButtonEvent(a_event);
        return true;
    }

    void HandleInterceptedStartButton(const RE::ButtonEvent *a_event)
    {
        if (MAP76::UI::State::g_waitingToOpenPauseMenu.load())
        {
            if (!a_event->QPressed())
            {
                MAP76::UI::State::g_waitingToOpenPauseMenu.store(false);
                QueueOpenPauseMenu();
            }
            NeuterButtonEvent(a_event);
            return;
        }

        if (HandleActiveStartHold(a_event))
        {
            return;
        }

        const bool isMapOpen = MAP76::UI::State::g_mapIsOpen.load();
        if (!isMapOpen && (MAP76::UI::IsPlayerInMenuMode() || !MAP76::UI::CanOpenPipboyMap(a_event->QJustPressed())))
        {
            return;
        }

        if (!a_event->QJustPressed())
        {
            NeuterButtonEvent(a_event);
            return;
        }

        if (isMapOpen)
        {
            if (auto *task = F4SE::GetTaskInterface())
            {
                task->AddUITask([]()
                {
                    if (MAP76::UI::State::g_mapIsOpen.load())
                    {
                        MAP76::UI::ToggleMAP76();
                    }

                    MAP76::UI::State::g_waitingToOpenPauseMenu.store(true);
                });
            }
            NeuterButtonEvent(a_event);
            return;
        }

        const float holdSeconds = MAP76::UI::Settings::gamepadMapHoldSeconds > 0.0f
            ? MAP76::UI::Settings::gamepadMapHoldSeconds
            : 0.0f;

        if (holdSeconds > 0.0f)
        {
            g_startHoldState.active = true;
            g_startHoldState.openedMap = false;
            g_startHoldState.pressedAt = std::chrono::steady_clock::now();
        }
        else if (auto *task = F4SE::GetTaskInterface())
        {
            task->AddUITask([]()
            {
                if (!MAP76::UI::State::g_mapIsOpen.load())
                {
                    MAP76::UI::ToggleMAP76();
                }
            });
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
                    if (!connectEvent->connected)
                    {
                        g_startHoldState.Reset();
                    }
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

            if (isMapOpen && MAP76::UI::State::g_coreApi && MAP76::UI::State::g_view)
            {
                MAP76::UI::State::g_coreApi->Invoke(MAP76::UI::State::g_view, isGamepad ? "window.dispatchEvent(new CustomEvent('gamepadStateChanged', {detail: true}))" : "window.dispatchEvent(new CustomEvent('gamepadStateChanged', {detail: false}))", nullptr);
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

    void ControllerInput::Register()
    {
        auto *menuControls = RE::MenuControls::GetSingleton();
        if (!menuControls)
            return;

        REX::INFO("MAP76: Hooking MenuControls::PerformInputProcessing...");
        REL::Relocation<uintptr_t> vtable{*reinterpret_cast<uintptr_t *>(menuControls)};
        g_originalPerformInputProcessing = vtable.write_vfunc(0x0, Hook_PerformInputProcessing);

        REX::INFO("MAP76: Successfully hooked MenuControls::PerformInputProcessing.");
    }
}
