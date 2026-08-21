#pragma once
#include <string>
#include <RE/Fallout.h>

namespace MAP76::Engine::PipboyUtils
{
    /**
     * @brief Safely extracts a string value from a Pip-Boy UI object by key.
     * @param a_obj Source Pip-Boy object.
     * @param a_key Property key name.
     * @param a_fallback Default string value if key is absent or invalid.
     * @return Extracted string or fallback value.
     */
    std::string GetPipboyString(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, const std::string &a_fallback = "");

    /**
     * @brief Safely extracts a 32-bit unsigned integer value from a Pip-Boy UI object by key.
     * @param a_obj Source Pip-Boy object.
     * @param a_key Property key name.
     * @param a_fallback Default uint32 value if key is absent or invalid.
     * @return Extracted integer or fallback value.
     */
    uint32_t GetPipboyUint32(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, uint32_t a_fallback = 0);

    /**
     * @brief Safely extracts a boolean value from a Pip-Boy UI object by key.
     * @param a_obj Source Pip-Boy object.
     * @param a_key Property key name.
     * @param a_fallback Default boolean value if key is absent or invalid.
     * @return Extracted boolean or fallback value.
     */
    bool GetPipboyBool(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, bool a_fallback = false);

    /**
     * @brief Safely extracts a float value from a Pip-Boy UI object by key.
     * @param a_obj Source Pip-Boy object.
     * @param a_key Property key name.
     * @param a_fallback Default float value if key is absent or invalid.
     * @return Extracted float or fallback value.
     */
    float GetPipboyFloat(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key, float a_fallback = 0.0f);

    /**
     * @brief Safely extracts a PipboyArray pointer from a Pip-Boy UI object by key.
     * @param a_obj Source Pip-Boy object.
     * @param a_key Property key name.
     * @return Pointer to PipboyArray or nullptr if key is absent or invalid.
     */
    RE::PipboyArray *GetPipboyArray(RE::PipboyObject *a_obj, const RE::BSFixedString &a_key);

    /**
     * @brief Evaluates a PipboyValue object or primitive and normalizes its numerical value to a float.
     * @param a_value Pointer to generic PipboyValue.
     * @return Value cast to float, or 0.0f if invalid or non-numeric.
     */
    float ExtractNumericValue(RE::PipboyValue *a_value);
}
