#include "PCH.h"
#include <filesystem>
#include "Engine/MapData.h"
#include "UI/Interop.h"
#include "UI/IconOverrides.h"
#include "Hooks/WindowProc.h"
#include "Hooks/MainUpdate.h"
#include "Engine/FavoritesManager.h"
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
        MAP76::UI::State::g_coreApi = new PRISMA_UI_FLAT_API::CoreAPI();
        MAP76::UI::State::g_viewApi = new PRISMA_UI_FLAT_API::ViewAPI();
        MAP76::UI::State::g_interopApi = new PRISMA_UI_FLAT_API::InteropAPI();
        MAP76::UI::State::g_controllerApi = new PRISMA_UI_FLAT_API::ControllerAPI();
        MAP76::UI::State::g_localizationApi = new PRISMA_UI_FLAT_API::LocalizationAPI();

        bool success = true;
        
        if (!PRISMA_UI_FLAT_API::Discover<PRISMA_UI_FLAT_API::ApiFeature::Core>(1, *MAP76::UI::State::g_coreApi)) {
            REX::ERROR("MAP76: Failed to discover PrismaUI Core API");
            success = false;
        }
        if (!PRISMA_UI_FLAT_API::Discover<PRISMA_UI_FLAT_API::ApiFeature::View>(1, *MAP76::UI::State::g_viewApi)) {
            REX::ERROR("MAP76: Failed to discover PrismaUI View API");
            success = false;
        }
        if (!PRISMA_UI_FLAT_API::Discover<PRISMA_UI_FLAT_API::ApiFeature::Interop>(1, *MAP76::UI::State::g_interopApi)) {
            REX::ERROR("MAP76: Failed to discover PrismaUI Interop API");
            success = false;
        }
        if (!PRISMA_UI_FLAT_API::Discover<PRISMA_UI_FLAT_API::ApiFeature::Controller>(1, *MAP76::UI::State::g_controllerApi)) {
            REX::ERROR("MAP76: Failed to discover PrismaUI Controller API");
            success = false;
        }
        if (!PRISMA_UI_FLAT_API::Discover<PRISMA_UI_FLAT_API::ApiFeature::Localization>(1, *MAP76::UI::State::g_localizationApi)) {
            REX::ERROR("MAP76: Failed to discover PrismaUI Localization API");
            success = false;
        }

        if (success) {
            REX::INFO("MAP76: Acquired PrismaUI Flat API surface.");
        } else {
            REX::ERROR("MAP76: Failed to acquire required PrismaUI API capabilities!");
            delete MAP76::UI::State::g_coreApi; MAP76::UI::State::g_coreApi = nullptr;
            delete MAP76::UI::State::g_viewApi; MAP76::UI::State::g_viewApi = nullptr;
            delete MAP76::UI::State::g_interopApi; MAP76::UI::State::g_interopApi = nullptr;
            delete MAP76::UI::State::g_controllerApi; MAP76::UI::State::g_controllerApi = nullptr;
            delete MAP76::UI::State::g_localizationApi; MAP76::UI::State::g_localizationApi = nullptr;
        }
        MAP76::UI::IconOverrides::Load();
        MAP76::Hooks::InstallMainUpdateHook();
        break;
    }
    case F4SE::MessagingInterface::kPostLoadGame:
    case F4SE::MessagingInterface::kNewGame:
        if (MAP76::UI::State::g_coreApi && MAP76::UI::State::g_view == 0)
        {
            MAP76::UI::Initialize();
        }
        break;
    }
}

extern "C" __declspec(dllexport) bool F4SEAPI F4SEPlugin_Query(const F4SE::QueryInterface* a_f4se, F4SE::PluginInfo* a_info)
{
    a_info->infoVersion = F4SE::PluginInfo::kVersion;
    a_info->name = MAP76_PLUGIN_NAME;
    a_info->version = MAP76_VERSION_INT;

    if (a_f4se->IsEditor()) {
        return false;
    }

    return true;
}

extern "C" __declspec(dllexport) bool F4SEAPI F4SEPlugin_Load(const F4SE::LoadInterface *a_f4se)
{
    F4SE::InitInfo info;
    info.logName = MAP76_PLUGIN_NAME;
    F4SE::Init(a_f4se, info);

    REX::INFO("{}: Log Engine Online.", MAP76_PLUGIN_NAME);

    const auto serialization = F4SE::GetSerializationInterface();
    serialization->SetUniqueID('MP76');
    serialization->SetRevertCallback(MAP76::Engine::FavoritesManager::RevertCallback);
    serialization->SetSaveCallback(MAP76::Engine::FavoritesManager::SaveCallback);
    serialization->SetLoadCallback(MAP76::Engine::FavoritesManager::LoadCallback);

    F4SE::GetMessagingInterface()->RegisterListener(OnF4SEMessage);
    return true;
}
