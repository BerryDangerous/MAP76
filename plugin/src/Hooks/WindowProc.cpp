#include "PCH.h"
#include "Hooks/WindowProc.h"
#include "UI/Interop.h"
#include "Constants.h"

namespace PaperMap::Hooks
{
    LRESULT CALLBACK PaperMapWindowProcessor(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam)
    {
        WNDPROC originalProc = g_oldWndProc;

        if (uMsg == WM_KEYDOWN)
        {
            if (wParam == Constants::Input::KEY_M)
            {
                if (!UI::IsPlayerInMenuMode())
                {
                    UI::TogglePaperMap();
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
                REX::INFO("f4map: Subclassing Fallout 4 Window Procedure hook...");
                g_oldWndProc = reinterpret_cast<WNDPROC>(SetWindowLongPtrA(
                    gameWindow,
                    GWLP_WNDPROC,
                    reinterpret_cast<LONG_PTR>(PaperMapWindowProcessor)));
            }
        }
        else
        {
            REX::ERROR("f4map: Could not find main 'Fallout4' HWND. Input hooking failed!");
        }
    }
}
