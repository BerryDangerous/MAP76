#include "PCH.h"
#include <filesystem>
#include "Engine/MapData.h"
#include "UI/Interop.h"
#include "UI/IconOverrides.h"
#include "Hooks/WindowProc.h"
#include "Hooks/MainUpdate.h"
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
        REX::INFO("MAP76: Game data ready. Requesting PrismaUI API...");
        MAP76::UI::State::g_api = PRISMA_UI_API::RequestPluginAPI<PRISMA_UI_API::IVPrismaUI4>();
        if (!MAP76::UI::State::g_api)
        {
            REX::ERROR("MAP76: Failed to acquire PrismaUI API surface!");
        }
        MAP76::UI::IconOverrides::Load();
        MAP76::Hooks::InstallMainUpdateHook();
        break;
    }
    case F4SE::MessagingInterface::kPostLoadGame:
    case F4SE::MessagingInterface::kNewGame:
        if (MAP76::UI::State::g_api && MAP76::UI::State::g_view == 0)
        {
            REX::INFO("MAP76: Creating HTML view surface...");
            MAP76::UI::Initialize();
        }
        break;
    }
}

extern "C" __declspec(dllexport) bool F4SEAPI F4SEPlugin_Query(const F4SE::QueryInterface* a_f4se, F4SE::PluginInfo* a_info)
{
    a_info->infoVersion = F4SE::PluginInfo::kVersion;
    a_info->name = "MAP76";
    a_info->version = 1;

    if (a_f4se->IsEditor()) {
        return false;
    }

    return true;
}

extern "C" __declspec(dllexport) bool F4SEAPI F4SEPlugin_Load(const F4SE::LoadInterface *a_f4se)
{
    F4SE::InitInfo info;
    info.logName = "MAP76";
    F4SE::Init(a_f4se, info);

    REX::INFO("MAP76: Log Engine Online.");
    F4SE::GetMessagingInterface()->RegisterListener(OnF4SEMessage);
    return true;
}
