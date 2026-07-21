#include "PCH.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Constants.h"

namespace PaperMap::Engine::PipboyUtils
{
    std::string GetPipboyString(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, const std::string &a_fallback)
    {
        if (!a_obj)
        {
            return a_fallback;
        }

        auto *val = a_obj->GetMember<RE::PipboyValue *>(a_key);
        if (!val || val->GetType() != RE::PipboyValue::kString)
        {
            return a_fallback;
        }

        const char **strPtr = reinterpret_cast<const char **>(reinterpret_cast<uintptr_t>(val) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
        if (strPtr && *strPtr && Memory::IsValidStringPointer(*strPtr))
        {
            return std::string(*strPtr);
        }

        return a_fallback;
    }

    uint32_t GetPipboyUint32(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, uint32_t a_fallback)
    {
        if (!a_obj)
        {
            return a_fallback;
        }

        auto *val = a_obj->GetMember<RE::PipboyValue *>(a_key);
        if (!val)
        {
            return a_fallback;
        }

        if (val->GetType() == RE::PipboyValue::kUint32 || val->GetType() == RE::PipboyValue::kInt32)
        {
            auto *primitive = reinterpret_cast<RE::PipboyPrimitiveValue<std::uint32_t> *>(val);
            return *primitive;
        }

        return a_fallback;
    }

    bool GetPipboyBool(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, bool a_fallback)
    {
        if (!a_obj)
        {
            return a_fallback;
        }

        auto *val = a_obj->GetMember<RE::PipboyValue *>(a_key);
        if (!val || val->GetType() != RE::PipboyValue::kBool)
        {
            return a_fallback;
        }

        auto *primitive = reinterpret_cast<RE::PipboyPrimitiveValue<bool> *>(val);
        return *primitive;
    }

    RE::PipboyArray *GetPipboyArray(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key)
    {
        if (!a_obj)
        {
            return nullptr;
        }

        auto *val = a_obj->GetMember<RE::PipboyValue *>(a_key);
        if (!val || val->GetType() != RE::PipboyValue::kArray)
        {
            return nullptr;
        }

        return reinterpret_cast<RE::PipboyArray *>(val);
    }
}
