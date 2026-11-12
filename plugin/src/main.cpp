#include "PCH.h"
#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <string>
#include <string_view>
#include "Engine/MapData.h"
#include "UI/Interop.h"
#include "UI/IconOverrides.h"
#include "Hooks/WindowProc.h"
#include "Hooks/MainUpdate.h"
#include "Engine/FavoritesManager.h"
#include "Engine/QuestManager.h"
#include "Engine/VaultBoy.h"

namespace
{
    constexpr std::string_view PRISMA_INI_PATH = "Data/F4SE/Plugins/PrismaUI_F4.ini";

    bool g_disabledForGpuRendering = false;
    bool g_shownGpuDisabledMessage = false;

    std::string_view TrimAscii(std::string_view a_sv) noexcept
    {
        while (!a_sv.empty() && std::isspace(static_cast<unsigned char>(a_sv.front()))) {
            a_sv.remove_prefix(1);
        }
        while (!a_sv.empty() && std::isspace(static_cast<unsigned char>(a_sv.back()))) {
            a_sv.remove_suffix(1);
        }
        return a_sv;
    }

    std::string ToLowerAscii(std::string_view a_sv)
    {
        std::string out(a_sv);
        std::transform(out.begin(), out.end(), out.begin(), [](unsigned char c) {
            return static_cast<char>(std::tolower(c));
        });
        return out;
    }

    /**
     * @brief Checks PrismaUI_F4.ini for [GPU] bAcceleratedRendering=1.
     */
    bool IsPrismaAcceleratedRenderingEnabled()
    {
        std::ifstream file(std::filesystem::path{PRISMA_INI_PATH});
        if (!file.is_open()) {
            return false;
        }

        std::string line;
        std::string currentSection;
        bool isFirstLine = true;

        while (std::getline(file, line)) {
            std::string_view view = line;
            if (isFirstLine) {
                isFirstLine = false;
                if (view.size() >= 3 &&
                    static_cast<unsigned char>(view[0]) == 0xEF &&
                    static_cast<unsigned char>(view[1]) == 0xBB &&
                    static_cast<unsigned char>(view[2]) == 0xBF) {
                    view.remove_prefix(3);
                }
            }

            if (const auto commentPos = view.find_first_of(";#"); commentPos != std::string_view::npos) {
                view = view.substr(0, commentPos);
            }
            view = TrimAscii(view);
            if (view.empty()) {
                continue;
            }

            if (view.front() == '[' && view.back() == ']') {
                currentSection = ToLowerAscii(TrimAscii(view.substr(1, view.size() - 2)));
                continue;
            }

            if (!currentSection.empty() && currentSection != "gpu") {
                continue;
            }

            const auto eqPos = view.find('=');
            if (eqPos == std::string_view::npos) {
                continue;
            }

            const std::string key = ToLowerAscii(TrimAscii(view.substr(0, eqPos)));
            if (key != "bacceleratedrendering") {
                continue;
            }

            const std::string val = ToLowerAscii(TrimAscii(view.substr(eqPos + 1)));
            return val == "1" || val == "true";
        }

        return false;
    }

    void ShowGpuDisabledMessageBox()
    {
        if (auto* msgManager = RE::MessageMenuManager::GetSingleton()) {
            msgManager->Create(
                "MAP76 Disabled",
                "MAP76 does not currently support PrismaUI GPU rendering and was disabled.\n\n"
                "Please open Data/F4SE/Plugins/PrismaUI_F4.ini, change bAcceleratedRendering to 0, and restart the game.",
                nullptr,
                RE::WARNING_TYPES::kDefault,
                "OK",
                nullptr,
                nullptr,
                nullptr,
                true);
        } else {
            REX::ERROR("MAP76: MessageMenuManager unavailable; could not show GPU rendering warning box.");
        }
    }
}

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
        if (IsPrismaAcceleratedRenderingEnabled()) {
            g_disabledForGpuRendering = true;
            REX::WARN("MAP76: Disabled because bAcceleratedRendering=1 in {}. Change it to 0 and restart the game.", PRISMA_INI_PATH);
            break;
        }

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
        MAP76::Engine::VaultBoy::ScanAndCacheVaultBoys();
        break;
    }
    case F4SE::MessagingInterface::kPostLoadGame:
    case F4SE::MessagingInterface::kNewGame:
        if (g_disabledForGpuRendering)
        {
            if (!g_shownGpuDisabledMessage)
            {
                g_shownGpuDisabledMessage = true;
                ShowGpuDisabledMessageBox();
            }
            break;
        }
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
