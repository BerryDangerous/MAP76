#pragma once
#include <Windows.h>

namespace MAP76::Hooks
{
    /**
     * @brief Custom Windows Procedure interceptor for handling hotkeys (e.g. 'M' key).
     *
     * Listens for key events when no vanilla menu is active and toggles the MAP76 UI layer.
     */
    LRESULT CALLBACK MAP76WindowProcessor(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);

    /// Stores the original Windows Window Procedure procedure pointer for passing back unhandled input.
    inline WNDPROC g_oldWndProc = nullptr;

    /**
     * @brief Hooks into the main Fallout 4 window procedure via SetWindowLongPtr.
     */
    void SetupWindowHook();
}
