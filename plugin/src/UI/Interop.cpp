#include <nlohmann/json.hpp>
#include "PCH.h"
#include "Engine/QuestManager.h"
#include "Hooks/WindowProc.h"
#include "UI/Actions.h"
#include "UI/Interop.h"
#include "UI/Payload.h"
#include "UI/Settings.h"
#include <thread>
#include <chrono>
#include <filesystem>
#include <format>
#include "RE/S/Setting.h"
#include "RE/U/UIUtils.h"
#include "REX/W32/OLE32.h"
#include "REX/W32/SHELL32.h"
#include "F4SE/API.h"

namespace MAP76::UI
{
    namespace
    {
        struct BackgroundActivityState
        {
            RE::Setting *alwaysActive = nullptr;
            RE::Setting *pauseOnAltTab = nullptr;
            bool alwaysActiveValue = false;
            bool pauseOnAltTabValue = false;
            bool active = false;
        };

        BackgroundActivityState g_backgroundActivityState;

        void ApplyBackgroundActivityOverride()
        {
            if (g_backgroundActivityState.active)
            {
                return;
            }

            auto *alwaysActive = RE::GetINISetting("bAlwaysActive:General");
            auto *pauseOnAltTab = RE::GetINISetting("bPauseOnAltTab:General");
            bool applied = false;

            if (alwaysActive && alwaysActive->GetType() == RE::Setting::SETTING_TYPE::kBinary)
            {
                g_backgroundActivityState.alwaysActive = alwaysActive;
                g_backgroundActivityState.alwaysActiveValue = alwaysActive->GetBinary();
                alwaysActive->SetBinary(true);
                applied = true;
            }

            if (pauseOnAltTab && pauseOnAltTab->GetType() == RE::Setting::SETTING_TYPE::kBinary)
            {
                g_backgroundActivityState.pauseOnAltTab = pauseOnAltTab;
                g_backgroundActivityState.pauseOnAltTabValue = pauseOnAltTab->GetBinary();
                pauseOnAltTab->SetBinary(false);
                applied = true;
            }

            g_backgroundActivityState.active = applied;
        }

        void RestoreBackgroundActivityOverride()
        {
            if (!g_backgroundActivityState.active)
            {
                return;
            }

            if (g_backgroundActivityState.alwaysActive &&
                g_backgroundActivityState.alwaysActive->GetType() == RE::Setting::SETTING_TYPE::kBinary)
            {
                g_backgroundActivityState.alwaysActive->SetBinary(g_backgroundActivityState.alwaysActiveValue);
            }

            if (g_backgroundActivityState.pauseOnAltTab &&
                g_backgroundActivityState.pauseOnAltTab->GetType() == RE::Setting::SETTING_TYPE::kBinary)
            {
                g_backgroundActivityState.pauseOnAltTab->SetBinary(g_backgroundActivityState.pauseOnAltTabValue);
            }

            g_backgroundActivityState = {};
        }

        void HandleConsoleMessage(PrismaView, PRISMA_UI_API::ConsoleMessageLevel level, const char *message)
        {
            switch (level)
            {
            case PRISMA_UI_API::ConsoleMessageLevel::Warning:
                REX::WARN("MAP76 view: {}", message);
                break;
            case PRISMA_UI_API::ConsoleMessageLevel::Error:
                REX::ERROR("MAP76 view: {}", message);
                break;
            default:
                REX::INFO("MAP76 view: {}", message);
                break;
            }
        }

        void HandleRequestFreshMapData(const char *arg)
        {
            if (auto *task = F4SE::GetTaskInterface())
            {
                task->AddTask([]() {
                    std::string freshMapJson = MAP76::UI::Payload::GetMapPayloadAsJSON();

                    if (MAP76::UI::Settings::writePayloadToFile) {
                        wchar_t* knownBuffer = nullptr;
                        if (REX::W32::SHGetKnownFolderPath(REX::W32::FOLDERID_Documents, REX::W32::KF_FLAG_DEFAULT, nullptr, std::addressof(knownBuffer)) == 0) {
                            std::unique_ptr<wchar_t[], decltype(&REX::W32::CoTaskMemFree)> knownPath(knownBuffer, REX::W32::CoTaskMemFree);
                            if (knownPath) {
                                auto now = std::chrono::system_clock::now();
                                auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
                                std::string fileName = std::format("MAP76_payload_{}.json", ms);
                                
                                std::filesystem::path path = knownPath.get();
                                path /= std::format("My Games/{}/F4SE/{}", F4SE::GetSaveFolderName(), fileName);
                                
                                std::ofstream payloadFile(path);
                                if (payloadFile.is_open()) {
                                    try {
                                        std::string indentedJson = nlohmann::json::parse(freshMapJson).dump(4);
                                        payloadFile << indentedJson;
                                        REX::INFO("MAP76: Saved payload snapshot to {} ({} bytes)", fileName, indentedJson.length());
                                    } catch (const nlohmann::json::parse_error& e) {
                                        payloadFile << freshMapJson;
                                        REX::INFO("MAP76: Saved unformatted payload snapshot to {} ({} bytes) due to parse error", fileName, freshMapJson.length());
                                    }
                                }
                            }
                        }
                    }

                    if (MAP76::UI::State::g_api && MAP76::UI::State::g_view)
                    {
                        MAP76::UI::State::g_api->InteropCall(MAP76::UI::State::g_view, "loadMarkers", freshMapJson.c_str());
                    }
                });
            }
        }

        void HandleRequestSettings(const char *arg)
        {
            if (auto *task = F4SE::GetTaskInterface())
            {
                task->AddTask([]() {
                    std::string settingsJson = Settings::Get().dump();
                    if (MAP76::UI::State::g_api && MAP76::UI::State::g_view)
                    {
                        MAP76::UI::State::g_api->InteropCall(MAP76::UI::State::g_view, "loadSettings", settingsJson.c_str());
                    }
                });
            }
        }

        void HandleRequestAssetCache(const char *arg)
        {
            bool forceRefresh = (arg && std::string(arg) == "refresh");
            if (auto *task = F4SE::GetTaskInterface())
            {
                task->AddTask([forceRefresh]() {
                    std::string assetPayload = MAP76::UI::Payload::GetAssetPayloadAsJSON(forceRefresh);
                    if (MAP76::UI::State::g_api && MAP76::UI::State::g_view)
                    {
                        MAP76::UI::State::g_api->InteropCall(MAP76::UI::State::g_view, "loadAssets", assetPayload.c_str());
                    }
                });
            }
        }

        void HandleSaveSettings(const char *arg)
        {
            std::string jsonStr = arg ? arg : "";
            if (!jsonStr.empty()) {
                if (auto *task = F4SE::GetTaskInterface())
                {
                    task->AddTask([jsonStr]() {
                        Settings::Save(jsonStr);
                        if (MAP76::UI::State::g_mapIsOpen.load()) {
                            auto *mainLoop = RE::Main::GetSingleton();
                            if (mainLoop) {
                                mainLoop->freezeTime = Settings::freezeSimulation;
                            }
                        }
                    });
                }
            }
        }

        void HandleRequestFastTravel(const char *arg)
        {
            try
            {
                if (!arg)
                    return;
                auto parsedJson = nlohmann::json::parse(arg);
                if (parsedJson.contains("formId") && parsedJson["formId"].is_number())
                {
                    uint32_t formId = parsedJson["formId"].get<uint32_t>();
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddTask([formId]() {
                            if (MAP76::UI::State::g_mapIsOpen.load())
                            {
                                MAP76::UI::ToggleMAP76();
                            }

                            std::thread([formId]() {
                                std::this_thread::sleep_for(std::chrono::milliseconds(150));
                                if (auto *innerTask = F4SE::GetTaskInterface())
                                {
                                    innerTask->AddTask([formId]() {
                                        MAP76::UI::Actions::ExecuteFastTravel(formId);
                                    });
                                }
                            }).detach();
                        });
                    }
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing requestFastTravel callback: {}", e.what());
            }
        }

        void HandleCheckFastTravel(const char *arg)
        {
            if (!arg)
                return;
                
            try
            {
                auto parsedJson = nlohmann::json::parse(arg);
                uint32_t formId = 0;
                if (parsedJson.contains("formId") && parsedJson["formId"].is_number())
                {
                    formId = parsedJson["formId"].get<uint32_t>();
                }
                
                if (auto *task = F4SE::GetTaskInterface())
                {
                    task->AddTask([formId]() {
                        try
                        {
                            auto *player = RE::PlayerCharacter::GetSingleton();
                            RE::TESObjectREFR *destMarker = nullptr;
                            if (formId != 0) {
                                destMarker = RE::TESForm::GetFormByID<RE::TESObjectREFR>(formId);
                            }
                            
                            std::string status = MAP76::UI::Actions::VerifyFastTravelConditions(player, destMarker);
                            if (MAP76::UI::State::g_api && MAP76::UI::State::g_view)
                            {
                                nlohmann::json response;
                                response["status"] = status;

                                std::string responseStr = response.dump();
                                MAP76::UI::State::g_api->InteropCall(MAP76::UI::State::g_view, "onFastTravelCheckResult", responseStr.c_str());
                            }
                        }
                        catch (const std::exception &e)
                        {
                            REX::ERROR("Error processing checkFastTravel callback task: {}", e.what());
                        }
                    });
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing checkFastTravel callback: {}", e.what());
            }
        }

        void HandleSetCustomMarker(const char *arg)
        {
            try
            {
                if (!arg) return;
                auto parsedJson = nlohmann::json::parse(arg);
                if (parsedJson.contains("x") && parsedJson.contains("y"))
                {
                    float x = parsedJson["x"].get<float>();
                    float y = parsedJson["y"].get<float>();
                    uint32_t worldspaceId = parsedJson.contains("worldspaceId") ? parsedJson["worldspaceId"].get<uint32_t>() : 0;
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddTask([x, y, worldspaceId]() {
                            MAP76::UI::Actions::SetCustomMarker(x, y, worldspaceId);
                        });
                    }
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing setCustomMarker callback: {}", e.what());
            }
        }

        void HandleRemoveCustomMarker(const char *)
        {
            if (auto *task = F4SE::GetTaskInterface())
            {
                task->AddTask([]() {
                    try
                    {
                        MAP76::UI::Actions::RemoveCustomMarker();
                    }
                    catch (const std::exception &e)
                    {
                        REX::ERROR("Error processing removeCustomMarker callback: {}", e.what());
                    }
                });
            }
        }

        void HandleToggleQuestActive(const char *arg)
        {
            try
            {
                if (!arg) return;
                auto parsedJson = nlohmann::json::parse(arg);
                if (parsedJson.contains("formId") && parsedJson["formId"].is_number())
                {
                    uint32_t formId = parsedJson["formId"].get<uint32_t>();
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddTask([formId]() {
                            MAP76::UI::Actions::ToggleQuestActive(formId);
                        });
                    }
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing toggleQuestActive callback: {}", e.what());
            }
        }

        void HandleMakeOnlyQuestActive(const char *arg)
        {
            try
            {
                if (!arg) return;
                auto parsedJson = nlohmann::json::parse(arg);
                if (parsedJson.contains("formId") && parsedJson["formId"].is_number())
                {
                    uint32_t formId = parsedJson["formId"].get<uint32_t>();
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddTask([formId]() {
                            MAP76::UI::Actions::MakeOnlyQuestActive(formId);
                        });
                    }
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing makeOnlyQuestActive callback: {}", e.what());
            }
        }

        void HandleTriggerEngineSound(const char *arg)
        {
            try
            {
                if (!arg) return;
                auto parsedJson = nlohmann::json::parse(arg);
                if (parsedJson.contains("soundName") && parsedJson["soundName"].is_string())
                {
                    std::string soundName = parsedJson["soundName"].get<std::string>();
                    if (auto *task = F4SE::GetTaskInterface())
                    {
                        task->AddTask([soundName]() {
                            RE::UIUtils::PlayMenuSound(soundName.c_str());
                        });
                    }
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing triggerEngineSound callback: {}", e.what());
            }
        }
    }
}

namespace MAP76::UI
{
    void Initialize()
    {
        Settings::Load();
        if (State::g_api && State::g_view == 0)
        {
            REX::INFO("MAP76: Creating HTML view surface...");
            State::g_view = State::g_api->CreateView("MAP76/index.html", OnDomReady);

            State::g_api->RegisterConsoleCallback(State::g_view, HandleConsoleMessage);

            State::g_api->Hide(State::g_view);
            State::g_mapIsOpen.store(false);

            Hooks::SetupWindowHook();
        }
    }

    void OnDomReady(PrismaView view)
    {
        if (!State::g_api)
            return;

        REX::INFO("DOM Ready. Registering Thread-Safe Event Listeners...");

        State::g_api->RegisterJSListener(view, "requestClose", [](const char *arg)
                                         { OnCloseRequestedFromJS(arg); });

        State::g_api->BindUIEvent(view, "requestFreshMapData", HandleRequestFreshMapData);
        State::g_api->BindUIEvent(view, "requestFastTravel", HandleRequestFastTravel);
        State::g_api->BindUIEvent(view, "checkFastTravel", HandleCheckFastTravel);
        State::g_api->BindUIEvent(view, "setCustomMarker", HandleSetCustomMarker);
        State::g_api->BindUIEvent(view, "removeCustomMarker", HandleRemoveCustomMarker);
        State::g_api->BindUIEvent(view, "toggleQuestActive", HandleToggleQuestActive);
        State::g_api->BindUIEvent(view, "makeOnlyQuestActive", HandleMakeOnlyQuestActive);
        State::g_api->BindUIEvent(view, "requestSettings", HandleRequestSettings);
        State::g_api->BindUIEvent(view, "requestAssetCache", HandleRequestAssetCache);
        State::g_api->BindUIEvent(view, "saveSettings", HandleSaveSettings);
        State::g_api->BindUIEvent(view, "triggerEngineSound", HandleTriggerEngineSound);

        std::string settingsJson = Settings::Get().dump();
        State::g_api->InteropCall(view, "loadSettings", settingsJson.c_str());

        if (auto *task = F4SE::GetTaskInterface())
        {
            task->AddTask([view]() {
                std::string assetPayload = MAP76::UI::Payload::GetAssetPayloadAsJSON(false);
                if (MAP76::UI::State::g_api && view)
                {
                    MAP76::UI::State::g_api->InteropCall(view, "loadAssets", assetPayload.c_str());
                }
            });
        }
    }

    void OnCloseRequestedFromJS(const char *a_argument)
    {
        if (!State::g_api)
            return;

        if (auto *task = F4SE::GetTaskInterface())
        {
            task->AddUITask([]() {
                if (State::g_mapIsOpen.load())
                {
                    ToggleMAP76();
                }
            });
        }
    }

    bool IsPlayerInMenuMode()
    {
        auto *ui = RE::UI::GetSingleton();
        if (!ui)
            return false;

        if (ui->GetMenuOpen("Console") ||
            ui->GetMenuOpen("PipboyMenu") ||
            ui->GetMenuOpen("WorkshopMenu") ||
            ui->GetMenuOpen("ContainerMenu") ||
            ui->GetMenuOpen("CraftingMenu") ||
            ui->GetMenuOpen("LockpickingMenu") ||
            ui->GetMenuOpen("ExamineMenu") ||
            ui->GetMenuOpen("LoadingMenu") ||
            ui->GetMenuOpen("TerminalMenu") ||
            ui->GetMenuOpen("VATSMenu") ||
            ui->GetMenuOpen("SitSleepMenu") ||
            ui->GetMenuOpen("DialogueMenu") ||
            ui->GetMenuOpen("BarterMenu") ||
            ui->GetMenuOpen("PauseMenu") ||
            ui->GetMenuOpen("MessageMenu") ||
            ui->GetMenuOpen("SleepWaitMenu") ||
            ui->GetMenuOpen("LevelUpMenu") ||
            ui->GetMenuOpen("SpecialMenu") ||
            ui->GetMenuOpen("NameMenu"))
        {
            return true;
        }

        if (ui->menuMode > 0)
        {
            return true;
        }

        return false;
    }

    void ToggleMAP76()
    {
        if (!State::g_api || !State::g_view)
        {
            return;
        }

        bool expected = State::g_mapIsOpen.load();
        State::g_mapIsOpen.store(!expected);
        bool currentMapState = State::g_mapIsOpen.load();

        auto *mainLoop = RE::Main::GetSingleton();
        if (currentMapState)
        {
            ApplyBackgroundActivityOverride();
            if (mainLoop)
            {
                mainLoop->freezeTime = Settings::freezeSimulation;
            }
            State::g_api->Show(State::g_view);
            State::g_api->Focus(State::g_view, true);
            State::g_api->Invoke(State::g_view, "if (window.onMapOpened) { window.onMapOpened(); } if (window.resetUIState) { window.resetUIState(); } if (window.requestFreshMapData) { window.requestFreshMapData(''); }");
        }
        else
        {
            RestoreBackgroundActivityOverride();
            if (mainLoop)
            {
                mainLoop->freezeTime = false;
            }
            State::g_api->Invoke(State::g_view, "if (window.onMapClosed) { window.onMapClosed(); } if (window.resetUIState) { window.resetUIState(); }");
            State::g_api->Unfocus(State::g_view);
            State::g_api->Hide(State::g_view);
        }
    }

    void TriggerFreshMapDataSync()
    {
        HandleRequestFreshMapData(nullptr);
    }
}
