#include "PCH.h"
#include <Windows.h>
#include "Engine/Memory.h"
#include "Constants.h"

namespace MAP76::Engine::Memory
{
    bool IsReferenceSafe(RE::TESObjectREFR *a_refr)
    {
        if (!a_refr)
        {
            return false;
        }
        __try
        {
            // Probe primitive memory
            volatile uint32_t probedFormId = a_refr->formID;
            if (a_refr->IsDeleted())
            {
                return false;
            }

            // Probe 3D position vector memory directly without virtual wrappers
            volatile float probedX = a_refr->GetPosition().x;
            volatile float probedY = a_refr->GetPosition().y;
            volatile float probedZ = a_refr->GetPosition().z;

            // Probe VTable integrity via an inline virtual call
            const char *probedName = a_refr->GetDisplayFullName();
            if (!probedName)
            {
                return false;
            }
            return true;
        }
        __except (EXCEPTION_EXECUTE_HANDLER)
        {
            return false;
        }
    }

    bool IsRefrPositionSafe(RE::TESObjectREFR *a_refr, RE::NiPoint3 &a_outPos)
    {
        if (!a_refr || reinterpret_cast<uintptr_t>(a_refr) < Constants::MIN_VALID_USER_PTR)
        {
            return false;
        }
        __try
        {
            a_outPos = a_refr->GetPosition();
            return true;
        }
        __except (EXCEPTION_EXECUTE_HANDLER)
        {
            return false;
        }
    }

    bool IsValidStringPointer(const char *ptr)
    {
        const bool isInProtectedNullRange = !ptr || reinterpret_cast<uintptr_t>(ptr) < Constants::MIN_VALID_USER_PTR;
        if (isInProtectedNullRange)
        {
            return false;
        }
        __try
        {
            volatile char probeChar = *ptr;
            return true;
        }
        __except (EXCEPTION_EXECUTE_HANDLER)
        {
            return false;
        }
    }

    bool IsValidWorldspace(RE::TESWorldSpace *a_worldspace)
    {
        if (!a_worldspace)
        {
            return false;
        }
        __try
        {
            return a_worldspace->GetFormType() == RE::ENUM_FORM_ID::kWRLD;
        }
        __except (EXCEPTION_EXECUTE_HANDLER)
        {
            return false;
        }
    }
}
