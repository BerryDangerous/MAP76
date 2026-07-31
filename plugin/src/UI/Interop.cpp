#include <nlohmann/json.hpp>
#include "PCH.h"
#include "Engine/QuestManager.h"
#include "Hooks/WindowProc.h"
#include "UI/Actions.h"
#include "UI/Interop.h"
#include "UI/Payload.h"

namespace PaperMap::UI
{
    namespace
    {
        void HandleConsoleMessage(PrismaView, PRISMA_UI_API::ConsoleMessageLevel level, const char *message)
        {
            switch (level)
            {
            case PRISMA_UI_API::ConsoleMessageLevel::Warning:
                REX::WARN("f4map view: {}", message);
                break;
            case PRISMA_UI_API::ConsoleMessageLevel::Error:
                REX::ERROR("f4map view: {}", message);
                break;
            default:
                REX::INFO("f4map view: {}", message);
                break;
            }
        }

        void HandleRequestFreshMapData(const char *arg)
        {
            std::string freshMapJson = PaperMap::UI::Payload::GetMapPayloadAsJSON();

            REX::INFO("f4map: Live Thread Snapshot Payload -> Stream Length: {}", freshMapJson.length());
            REX::INFO("f4map: Content: {}", freshMapJson);

            if (PaperMap::UI::State::g_api && PaperMap::UI::State::g_view)
            {
                PaperMap::UI::State::g_api->InteropCall(PaperMap::UI::State::g_view, "loadMarkers", freshMapJson.c_str());
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
                    PaperMap::UI::Actions::ExecuteFastTravel(formId);
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing requestFastTravel callback: {}", e.what());
            }
        }

        void HandleCheckFastTravel(const char *arg)
        {
            try
            {
                auto *player = RE::PlayerCharacter::GetSingleton();
                std::string status = PaperMap::UI::Actions::VerifyFastTravelConditions(player);

                if (PaperMap::UI::State::g_api && PaperMap::UI::State::g_view)
                {
                    nlohmann::json response;
                    response["status"] = status;

                    std::string responseStr = response.dump();
                    PaperMap::UI::State::g_api->InteropCall(PaperMap::UI::State::g_view, "onFastTravelCheckResult", responseStr.c_str());
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
                    PaperMap::UI::Actions::SetCustomMarker(x, y);
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing setCustomMarker callback: {}", e.what());
            }
        }

        void HandleRemoveCustomMarker(const char *)
        {
            try
            {
                PaperMap::UI::Actions::RemoveCustomMarker();
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing removeCustomMarker callback: {}", e.what());
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
                    PaperMap::UI::Actions::ToggleQuestActive(formId);
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
                    PaperMap::UI::Actions::MakeOnlyQuestActive(formId);
                }
            }
            catch (const std::exception &e)
            {
                REX::ERROR("Error processing makeOnlyQuestActive callback: {}", e.what());
            }
        }
    }
}

namespace PaperMap::UI
{
    void Initialize()
    {
        if (State::g_api && State::g_view == 0)
        {
            REX::INFO("f4map: Creating HTML view surface...");
            State::g_view = State::g_api->CreateView("papermap/index.html", OnDomReady);

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
    }

    void OnCloseRequestedFromJS(const char *a_argument)
    {
        if (!State::g_api)
            return;

        F4SE::GetTaskInterface()->AddTask([]()
                                          {
            if (State::g_mapIsOpen.load())
            {
                TogglePaperMap();
            } });
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

    void TogglePaperMap()
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
            if (mainLoop)
            {
                mainLoop->freezeTime = true;
            }
            State::g_api->Show(State::g_view);
            State::g_api->Focus(State::g_view, true);
            State::g_api->Invoke(State::g_view, "if (window.resetUIState) { window.resetUIState(); } if (window.requestFreshMapData) { window.requestFreshMapData(''); }");
        }
        else
        {
            if (mainLoop)
            {
                if (!IsPlayerInMenuMode())
                {
                    mainLoop->freezeTime = false;
                }
            }
            State::g_api->Invoke(State::g_view, "if (window.resetUIState) { window.resetUIState(); }");
            State::g_api->Unfocus(State::g_view);
            State::g_api->Hide(State::g_view);
        }
    }

    void TriggerFreshMapDataSync()
    {
        HandleRequestFreshMapData(nullptr);
    }
}
