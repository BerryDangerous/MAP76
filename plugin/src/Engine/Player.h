#pragma once
#include <RE/Fallout.h>

namespace PaperMap::Engine::Player
{
    /**
     * @brief Represents the active, dynamic runtime state of the player character.
     */
    struct State
    {
        RE::NiPoint3 position{0.0f, 0.0f, 0.0f};
        uint32_t worldspaceFormID{0};
        float headingDegrees{0.0f};
    };

    /**
     * @brief Collects the active runtime player state from the engine.
     */
    State GetCurrentState();
}
