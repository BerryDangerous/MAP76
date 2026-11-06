#pragma once

#include "SWF/BitReader.h"
#include "SWF/Types.h"
#include <cstdint>
#include <string>
#include <vector>

namespace MAP76::SWF
{
    /**
     * @brief A sub-path within a vector shape, corresponding to a distinct fill or stroke style.
     */
    struct ShapeSubPath
    {
        std::string pathId;                 // Unique dictionary ID (e.g. "p16_0", "p16_1" or "p16")
        std::string svgPath;                // SVG path string ('d' attribute: "M... L... Q...")
        std::string fill{"#ffffff"};       // Solid fill color (e.g. "#ffffff", "#333333")
        float opacity{1.0f};                // Fill opacity (0.0 to 1.0)
    };

    /**
     * @brief Represents a parsed vector shape definition extracted from a DefineShape tag.
     */
    struct ExtractedShape
    {
        uint16_t shapeId{0};
        Rect bounds{};
        std::vector<ShapeSubPath> subPaths; // Disjoint sub-paths partitioned by fill style
    };

    /**
     * @brief Parses Flash SWF DefineShape tags (DefineShape, DefineShape2, DefineShape3, DefineShape4)
     *        and converts raw Flash edge/shape records into standard SVG Path2D strings.
     *
     * In Flash SWF, shapes are defined using:
     *   - StyleChangeRecord: sets pen origin (SVG 'M x y') and changes active fill/stroke.
     *   - StraightEdgeRecord: straight lines with relative deltas (SVG 'L x y').
     *   - CurvedEdgeRecord: quadratic Bézier curves with control and anchor points (SVG 'Q cx cy x y').
     *
     * Coordinates are converted from Flash twips to pixels (twips / 20.0f).
     */
    class ShapeParser
    {
    public:
        /**
         * @brief Parses a DefineShape tag payload.
         * @param a_tagType SWF Tag type (2 = DefineShape, 22 = DefineShape2, 32 = DefineShape3, 83 = DefineShape4).
         * @param a_reader BitReader initialized to the start of the tag's payload.
         * @return An ExtractedShape holding the shape ID, bounding box, and partitioned SVG sub-paths.
         */
        static ExtractedShape Parse(uint16_t a_tagType, BitReader& a_reader);
    };
}
