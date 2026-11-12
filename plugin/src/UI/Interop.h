#pragma once
#include "PrismaUI_F4_Modern_API.h"
#include <atomic>

namespace MAP76::UI
{
    /**
     * @brief Holds global runtime state references for Prisma UI integration.
     */
    namespace State
    {
        inline PRISMA_UI_FLAT_API::CoreAPI *g_coreApi = nullptr;
        inline PRISMA_UI_FLAT_API::ViewAPI *g_viewApi = nullptr;
        inline PRISMA_UI_FLAT_API::InteropAPI *g_interopApi = nullptr;
        inline PRISMA_UI_FLAT_API::ControllerAPI *g_controllerApi = nullptr;
        inline PRISMA_UI_FLAT_API::LocalizationAPI *g_localizationApi = nullptr;
        inline PrismaView g_view = 0;

        inline std::atomic<bool> g_mapIsOpen{false};
        inline std::atomic<bool> g_waitingToOpenPauseMenu{false};
        inline std::atomic<bool> g_isDomReady{false};
        inline std::atomic<int> g_recoveryRetries{0};
    }

    /**
     * @brief Initializes the Prisma UI HTML view surface, registers console callbacks, and sets up window input hooks.
     */
    void Initialize();

    /**
     * @brief Tears down the current view and creates a new one as part of bounded recovery.
     */
    void RecreateView();

    /**
     * @brief Toggles the MAP76 UI surface open or closed.
     *
     * Handles game time freeze state, UI focus, and triggering fresh data synchronization.
     */
    void ToggleMAP76();

    /**
     * @brief Checks if any interactive Fallout 4 menu, workbench, scope, or text entry mode is currently active.
     * @return True if opening the map overlay should be suppressed.
     */
    bool IsPlayerInMenuMode();

    /**
     * @brief Checks whether opening the Pip-Boy map is currently permitted by settings and engine state.
     * @param a_logFailure When true, logs diagnostic details if opening is blocked.
     * @return True if the map may be opened (always true when requirePipboyToOpenMap is disabled).
     */
    bool CanOpenPipboyMap(bool a_logFailure = false);

    /**
     * @brief Callback executed when the HTML DOM is fully ready.
     * @param view Active PrismaView handle.
     */
    void OnDomReady(PrismaView view);

    /**
     * @brief Callback executed when the JavaScript UI signals a close map request.
     * @param a_argument Optional payload argument string.
     */
    void OnCloseRequestedFromJS(const char *a_argument);

    /**
     * @brief Triggers an immediate map payload generation and pushes it to JavaScript via loadMarkers.
     */
    void TriggerFreshMapDataSync();
}
