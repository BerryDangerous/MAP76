#include "PCH.h"
#include "Hooks/WindowProc.h"
#include "UI/Interop.h"
#include "Constants.h"
#include "F4SE/API.h"
#include "RE/U/UIMessageQueue.h"
#include "RE/B/BSFixedString.h"

namespace MAP76::Hooks
{
    LRESULT CALLBACK MAP76WindowProcessor(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
    {
        WNDPROC originalProc = g_oldWndProc;

        if (uMsg == WM_KEYDOWN)
        {
            if (wParam == Constants::Input::KEY_M)
            {
                if (!UI::State::g_mapIsOpen.load() && !UI::IsPlayerInMenuMode())
                {
                    UI::ToggleMAP76();
                    return 0;
                }
            }

            if (wParam == VK_ESCAPE)
            {
                bool isRepeat = (lParam & (1 << 30)) != 0;
                if (UI::State::g_mapIsOpen.load())
                {
                    if (!isRepeat)
                    {
                        UI::ToggleMAP76();
                        UI::State::g_waitingToOpenPauseMenu.store(true);
                    }
                    return 0;
                }
            }
        }

        if (uMsg == WM_KEYUP)
        {
            if (wParam == VK_ESCAPE && UI::State::g_waitingToOpenPauseMenu.load())
            {
                UI::State::g_waitingToOpenPauseMenu.store(false);
                if (auto *task = F4SE::GetTaskInterface()) {
                    task->AddUITask([]() {
                        if (auto *msgQ = RE::UIMessageQueue::GetSingleton())
                            msgQ->AddMessage(RE::BSFixedString("PauseMenu"), RE::UI_MESSAGE_TYPE::kShow);
                    });
                }
                return 0;
            }
        }

        if (originalProc)
        {
            return CallWindowProc(originalProc, hWnd, uMsg, wParam, lParam);
        }
        return DefWindowProcA(hWnd, uMsg, wParam, lParam);
    }

    void SetupWindowHook()
    {
        HWND gameWindow = FindWindowA("Fallout4", nullptr);
        if (gameWindow)
        {
            if (!g_oldWndProc)
            {
                REX::INFO("MAP76: Subclassing Fallout 4 Window Procedure hook...");
                g_oldWndProc = reinterpret_cast<WNDPROC>(SetWindowLongPtrA(
                    gameWindow,
                    GWLP_WNDPROC,
                    reinterpret_cast<LONG_PTR>(MAP76WindowProcessor)));
                REX::INFO("MAP76: Successfully subclassed Window Procedure.");
            }
        }
        else
        {
            REX::ERROR("MAP76: Could not find main 'Fallout4' HWND. Input hooking failed!");
        }
    }
}
