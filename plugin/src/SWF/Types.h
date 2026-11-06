#pragma once

#include <array>
#include <cstdint>
#include <format>
#include <map>
#include <optional>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

namespace MAP76::SWF
{
    /**
     * @brief Macromedia / Adobe SWF Tag IDs used in vector extraction.
     */
    enum class TagType : uint16_t
    {
        End          = 0,
        ShowFrame    = 1,
        DefineShape  = 2,
        PlaceObject  = 4,
        RemoveObject = 5,
        DefineShape2 = 22,
        PlaceObject2 = 26,
        RemoveObject2 = 28,
        DefineShape3 = 32,
        DefineSprite = 39,
        PlaceObject3 = 70,
        DefineShape4 = 83
    };

    /**
     * @brief Checks if a given tag ID defines vector shape geometry (DefineShape 1..4).
     */
    [[nodiscard]] constexpr bool IsShapeTag(uint16_t a_tagType) noexcept
    {
        return a_tagType == static_cast<uint16_t>(TagType::DefineShape) ||
               a_tagType == static_cast<uint16_t>(TagType::DefineShape2) ||
               a_tagType == static_cast<uint16_t>(TagType::DefineShape3) ||
               a_tagType == static_cast<uint16_t>(TagType::DefineShape4);
    }

    /**
     * @brief A 2D affine transformation matrix for 2D graphics rendering.
     *
     * Flash SWF and HTML5 Canvas 2D represent 2D affine transformations as a 3x3 matrix:
     *   | a   c   tx |
     *   | b   d   ty |
     *   | 0   0    1 |
     *
     * Canvas 2D context.transform(a, b, c, d, e, f) maps directly to:
     *   a: horizontal scale
     *   b: horizontal skew
     *   c: vertical skew
     *   d: vertical scale
     *   e (tx): horizontal translation
     *   f (ty): vertical translation
     */
    struct Matrix2D
    {
        float a{1.0f};
        float b{0.0f};
        float c{0.0f};
        float d{1.0f};
        float tx{0.0f};
        float ty{0.0f};

        /**
         * @brief Multiplies this matrix by a child matrix (parent * child).
         * Used to flatten nested Flash sprite transformation hierarchies into a single matrix.
         */
        [[nodiscard]] Matrix2D Multiply(const Matrix2D& a_child) const noexcept
        {
            return Matrix2D{
                .a  = (a * a_child.a) + (c * a_child.b),
                .b  = (b * a_child.a) + (d * a_child.b),
                .c  = (a * a_child.c) + (c * a_child.d),
                .d  = (b * a_child.c) + (d * a_child.d),
                .tx = (a * a_child.tx) + (c * a_child.ty) + tx,
                .ty = (b * a_child.tx) + (d * a_child.ty) + ty
            };
        }

        /**
         * @brief Exports the matrix as a 6-element numeric tuple [a, b, c, d, tx, ty].
         * This directly matches the Canvas 2D numeric tuple consumed by Ultralight.
         */
        [[nodiscard]] std::array<float, 6> ToArray() const noexcept
        {
            return { a, b, c, d, tx, ty };
        }

        [[nodiscard]] bool IsIdentity() const noexcept
        {
            return a == 1.0f && b == 0.0f && c == 0.0f && d == 1.0f && tx == 0.0f && ty == 0.0f;
        }
    };

    /**
     * @brief Represents a Flash SWF bounding rectangle.
     * Flash stores coordinates internally in "twips" (1/20th of a point/pixel).
     */
    struct Rect
    {
        int32_t xMinTwips{0};
        int32_t xMaxTwips{0};
        int32_t yMinTwips{0};
        int32_t yMaxTwips{0};

        [[nodiscard]] float XMin() const noexcept { return static_cast<float>(xMinTwips) / 20.0f; }
        [[nodiscard]] float XMax() const noexcept { return static_cast<float>(xMaxTwips) / 20.0f; }
        [[nodiscard]] float YMin() const noexcept { return static_cast<float>(yMinTwips) / 20.0f; }
        [[nodiscard]] float YMax() const noexcept { return static_cast<float>(yMaxTwips) / 20.0f; }

        [[nodiscard]] float Width() const noexcept { return XMax() - XMin(); }
        [[nodiscard]] float Height() const noexcept { return YMax() - YMin(); }
    };

    /**
     * @brief RGBA color representation used in SWF fill styles and color transforms.
     */
    struct ColorRGBA
    {
        uint8_t r{255};
        uint8_t g{255};
        uint8_t b{255};
        uint8_t a{255};

        [[nodiscard]] std::string ToHex() const
        {
            return std::format("#{:02x}{:02x}{:02x}", r, g, b);
        }

        [[nodiscard]] float Opacity() const noexcept
        {
            return static_cast<float>(a) / 255.0f;
        }
    };

    /**
     * @brief Color transform (CXFORM / CXFORMWITHALPHA) applied to Flash display objects.
     */
    struct ColorTransform
    {
        float alphaMult{1.0f};
        float alphaAdd{0.0f};

        [[nodiscard]] float ComputeFinalAlpha(float a_baseAlpha = 1.0f) const noexcept
        {
            float result = (a_baseAlpha * alphaMult) + alphaAdd;
            return std::clamp(result, 0.0f, 1.0f);
        }
    };

    // Standard Bethesda Pip-Boy quest animation stage bounds (7729 x 6980 twips)
    inline constexpr float DEFAULT_STAGE_WIDTH = 386.45f;
    inline constexpr float DEFAULT_STAGE_HEIGHT = 349.0f;

    /**
     * @brief An atomic draw call command executed by the frontend Canvas 2D renderer.
     * Single-letter property names ('p', 'f', 'o', 't') map directly to the compact JSON
     * protocol consumed by the view, minimizing bridge serialization overhead.
     */
    struct DrawCall
    {
        std::string p;                           // Unique path dictionary ID (e.g. "p114")
        std::string f{"#ffffff"};              // Fill color in hex or "none"
        float o{1.0f};                           // Fill opacity (0.0 to 1.0)
        std::optional<Matrix2D> t{std::nullopt}; // Affine transform matrix
    };

    /**
     * @brief Dynamic frame data in the animation timeline.
     */
    struct FrameData
    {
        Matrix2D t{};                         // Root frame transform matrix
        std::vector<DrawCall> calls;          // Draw calls rendered in depth order for this frame
    };

    /**
     * @brief Complete extracted and deduplicated vector animation dataset.
     */
    struct VaultBoyAnimationData
    {
        float width{DEFAULT_STAGE_WIDTH};         // Canvas display width in pixels
        float height{DEFAULT_STAGE_HEIGHT};       // Canvas display height in pixels
        std::map<std::string, std::string> paths; // Deduplicated SVG path dictionary (e.g. "p0" -> "M... Q... L...")
        std::vector<FrameData> frames;            // Sequential animation frames
    };

    // JSON serialization mappings for UI consumption
    inline void to_json(nlohmann::json& j, const DrawCall& call)
    {
        j = nlohmann::json{
            {"p", call.p},
            {"f", call.f},
            {"o", call.o}
        };

        if (call.t && !call.t->IsIdentity()) {
            j["t"] = call.t->ToArray();
        } else {
            j["t"] = nullptr;
        }
    }

    inline void to_json(nlohmann::json& j, const FrameData& frame)
    {
        j = nlohmann::json{
            {"t", frame.t.ToArray()},
            {"calls", frame.calls}
        };
    }

    inline void to_json(nlohmann::json& j, const VaultBoyAnimationData& anim)
    {
        j = nlohmann::json{
            {"width", anim.width},
            {"height", anim.height},
            {"paths", anim.paths},
            {"frames", anim.frames}
        };
    }
}
