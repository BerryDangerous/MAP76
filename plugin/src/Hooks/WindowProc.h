#pragma once
#include <Windows.h>

namespace PaperMap::Hooks
{
    /**
     * @brief Custom Windows Procedure interceptor for handling hotkeys (e.g. 'M' key).
     *
     * Listens for key events when no vanilla menu is active and toggles the paper map UI layer.
     */
    LRESULT CALLBACK PaperMapWindowProcessor(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);

    /// Stores the original Windows Window Procedure procedure pointer for passing back unhandled input.
    inline WNDPROC g_oldWndProc = nullptr;

    /**
     * @brief Hooks into the main Fallout 4 window procedure via SetWindowLongPtr.
     */
    void SetupWindowHook();
}
