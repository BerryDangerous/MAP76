#include "PCH.h"
#include "Hooks/WindowProc.h"
#include "UI/Interop.h"
#include "Constants.h"

namespace MAP76::Hooks
{
    LRESULT CALLBACK MAP76WindowProcessor(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
    {
        WNDPROC originalProc = g_oldWndProc;

        if (uMsg == WM_KEYDOWN)
        {
            if (wParam == Constants::Input::KEY_M)
            {
                if (!UI::IsPlayerInMenuMode())
                {
                    UI::ToggleMAP76();
                    return 0;
                }
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
            }
        }
        else
        {
            REX::ERROR("MAP76: Could not find main 'Fallout4' HWND. Input hooking failed!");
        }
    }
}
