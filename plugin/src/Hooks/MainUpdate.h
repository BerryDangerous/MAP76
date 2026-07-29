#pragma once

namespace PaperMap::Hooks
{
    /**
     * @brief Registers the permanent frame update task to push tick events to UI when map is open.
     */
    void InstallMainUpdateHook();
}
