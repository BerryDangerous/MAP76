#pragma once
#include <RE/Fallout.h>

namespace MAP76::Engine::Player
{
    /**
     * @brief Represents the active, dynamic runtime state of the player character.
     */
    struct State
    {
        RE::NiPoint3 position{0.0f, 0.0f, 0.0f};
        uint32_t worldspace{0};
        float headingDegrees{0.0f};
        float caps{0.0f};
        float currentWeight{0.0f};
        float maxWeight{0.0f};
    };

    /**
     * @brief Collects the active runtime player state from the engine.
     */
    State GetCurrentState();
}
