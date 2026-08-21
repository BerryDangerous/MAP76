#pragma once
#include <RE/Fallout.h>

namespace MAP76::Engine::Memory
{
    /**
     * @brief Safely verifies if a reference is valid and its memory layout is intact.
     *
     * Uses MSVC Structured Exception Handling (SEH) to probe primitive fields, 3D data,
     * and the object's VTable. This prevents hardware-level access violations (CTDs)
     * if the underlying quest or reference has been corrupted or partially deallocated.
     *
     * @note Must remain isolated in its own function to prevent MSVC compiler errors
     *       C2712/C2713 (which occur when mixing SEH with object destruction).
     */
    bool IsReferenceSafe(RE::TESObjectREFR *a_refr);

    /**
     * @brief Safely probes a reference's 3D position without requiring a display name.
     * @param a_refr Target reference object.
     * @param a_outPos Output point struct populated with 3D coordinates if safe.
     * @return true if valid and position probed safely, false otherwise.
     */
    bool IsRefrPositionSafe(RE::TESObjectREFR *a_refr, RE::NiPoint3 &a_outPos);

    /**
     * @brief Checks if a raw pointer points to readable string memory.
     *
     * Prevents crashes by avoiding the zero-page protected range and using SEH
     * to safely attempt a 1-byte read before passing the pointer to std::string.
     */
    bool IsValidStringPointer(const char *ptr);

    /**
     * @brief Safely verifies if a TESWorldSpace pointer is valid and represents a kWRLD form.
     *
     * Uses MSVC Structured Exception Handling (SEH) to probe the worldspace pointer,
     * preventing crashes if the pointer is dangling or uninitialized.
     */
    bool IsValidWorldspace(RE::TESWorldSpace *a_worldspace);
}
