#include "PCH.h"
#include "Engine/Player.h"
#include "Engine/MapData.h"
#include "Constants.h"

namespace PaperMap::Engine::Player
{
    State GetCurrentState()
    {
        State state{};
        auto *player = RE::PlayerCharacter::GetSingleton();
        if (!player)
        {
            return state;
        }

        state.position = player->GetPosition();

        auto *world = PaperMap::Engine::GetReferenceWorldspace(player, &state.position);
        state.worldspaceFormID = world ? world->formID : 0;

        if (auto *camera = RE::PlayerCamera::GetSingleton())
        {
            state.headingDegrees = camera->heading * Constants::Map::RAD_TO_DEG;
        }

        return state;
    }
}
