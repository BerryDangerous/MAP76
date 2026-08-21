#include "PCH.h"
#include "Engine/PipboyUtils.h"
#include "Engine/Memory.h"
#include "Constants.h"

namespace MAP76::Engine::PipboyUtils
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

        auto *fixedStr = reinterpret_cast<const RE::BSFixedString *>(reinterpret_cast<uintptr_t>(val) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
        if (fixedStr && fixedStr->c_str() && Memory::IsValidStringPointer(fixedStr->c_str()))
        {
            return std::string(fixedStr->c_str());
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

    float GetPipboyFloat(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, float a_fallback)
    {
        if (!a_obj)
        {
            return a_fallback;
        }

        auto *val = a_obj->GetMember<RE::PipboyValue *>(a_key);
        if (!val || val->GetType() != RE::PipboyValue::kFloat)
        {
            return a_fallback;
        }

        return *reinterpret_cast<const float*>(reinterpret_cast<uintptr_t>(val) + 0x18);
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

    float ExtractNumericValue(RE::PipboyValue *value)
    {
        if (!value)
            return 0.0f;

        switch (value->GetType())
        {
        case RE::PipboyValue::kObject:
        {
            auto *object = reinterpret_cast<RE::PipboyObject *>(value);
            uint32_t uintVal = PipboyUtils::GetPipboyUint32(object, "Value", 0);
            if (uintVal == 0)
                uintVal = PipboyUtils::GetPipboyUint32(object, "value", 0);
            if (uintVal > 0)
                return static_cast<float>(uintVal);

            float floatVal = PipboyUtils::GetPipboyFloat(object, "Value", 0.0f);
            if (floatVal == 0.0f)
                floatVal = PipboyUtils::GetPipboyFloat(object, "value", 0.0f);
            return floatVal;
        }
        case RE::PipboyValue::kFloat:
        {
            return *reinterpret_cast<const float *>(reinterpret_cast<const uintptr_t>(value) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
        }
        case RE::PipboyValue::kUint32:
        case RE::PipboyValue::kInt32:
        case RE::PipboyValue::kUint8:
        case RE::PipboyValue::kInt8:
        {
            auto rawVal = *reinterpret_cast<const uint32_t *>(reinterpret_cast<const uintptr_t>(value) + Constants::PIPBOY_VALUE_PAYLOAD_OFFSET);
            return static_cast<float>(rawVal);
        }
        default:
            return 0.0f;
        }
    }
}
