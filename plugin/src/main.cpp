#include "PCH.h"
#include <filesystem>
#include "Engine/MapData.h"
#include "UI/Interop.h"
#include "Hooks/WindowProc.h"
#include "Engine/QuestManager.h"

/**
 * @brief F4SE messaging listener callback.
 * Handles lifecycle events such as game data initialization, new game, and save load.
 */
void OnF4SEMessage(F4SE::MessagingInterface::Message *a_msg)
{
    switch (a_msg->type)
    {
    case F4SE::MessagingInterface::kGameDataReady:
    {
        REX::INFO("f4map: Game data ready. Requesting PrismaUI API...");
        PaperMap::UI::State::g_api = PRISMA_UI_API::RequestPluginAPI<PRISMA_UI_API::IVPrismaUI4>();
        if (!PaperMap::UI::State::g_api)
        {
            REX::ERROR("f4map: Failed to acquire PrismaUI API surface!");
        }
        break;
    }
    case F4SE::MessagingInterface::kPostLoadGame:
    case F4SE::MessagingInterface::kNewGame:
        if (PaperMap::UI::State::g_api && PaperMap::UI::State::g_view == 0)
        {
            REX::INFO("f4map: Creating HTML view surface...");
            PaperMap::UI::Initialize();
        }
        break;
    }
}

extern "C" __declspec(dllexport) bool F4SEAPI F4SEPlugin_Load(const F4SE::LoadInterface *a_f4se)
{
    F4SE::InitInfo info;
    info.logName = "f4map";
    F4SE::Init(a_f4se, info);

    REX::INFO("f4map: Log Engine Online.");
    F4SE::GetMessagingInterface()->RegisterListener(OnF4SEMessage);
    return true;
}
