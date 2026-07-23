#pragma once
#include <string>
#include <stdint.h>
#include <RE/Fallout.h>

namespace PaperMap::UI::Actions
{
    /**
     * @brief Validates all game conditions required to fast travel.
     *
     * Checks player health, combat state, interior restrictions, survival difficulty mode,
     * carry weight vs perks, and control map lock state.
     *
     * @param a_player Target player character instance.
     * @return Status string ("SUCCESS", "PLAYER_DEAD", "COMBAT", "INTERIOR", "SURVIVAL", "OVERBURDENED", "QUEST_LOCKED", "UNKNOWN_ERROR").
     */
    std::string VerifyFastTravelConditions(RE::PlayerCharacter *a_player);

    /**
     * @brief Triggers the fast travel sequence to a specified marker FormID.
     *
     * Validates travel conditions, signals UI unfocus/hide if needed, and queues engine fast travel.
     *
     * @param a_formId FormID of target destination marker reference.
     */
    void ExecuteFastTravel(uint32_t a_formId);

    /**
     * @brief Sets or moves the player custom marker to specified world coordinates.
     */
    void SetCustomMarker(float a_x, float a_y);

    /**
     * @brief Removes the player custom marker if active.
     */
    void RemoveCustomMarker();
}
