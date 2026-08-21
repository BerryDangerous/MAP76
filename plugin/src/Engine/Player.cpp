#include "PCH.h"
#include "Engine/Player.h"
#include "Engine/MapData.h"
#include "Constants.h"

namespace MAP76::Engine::Player
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

        auto *world = MAP76::Engine::GetReferenceWorldspace(player, &state.position);
        state.worldspace = world ? world->formID : 0;

        if (auto *camera = RE::PlayerCamera::GetSingleton())
        {
            state.headingDegrees = camera->heading * Constants::Map::RAD_TO_DEG;
        }

        if (player->inventoryList)
        {
            state.currentWeight = player->inventoryList->cachedWeight;
        }

        if (auto *avSingleton = RE::ActorValue::GetSingleton())
        {
            if (avSingleton->carryWeight)
            {
                state.maxWeight = player->GetActorValue(*avSingleton->carryWeight);
            }
        }

        state.caps = static_cast<float>(player->GetGoldAmount());

        return state;
    }
}
