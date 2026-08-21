#pragma once

namespace MAP76::Hooks
{
    /**
     * @brief Registers the permanent frame update task to push tick events to UI when map is open.
     */
    void InstallMainUpdateHook();
}
