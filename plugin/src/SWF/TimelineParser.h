#pragma once

#include "SWF/BitReader.h"
#include "SWF/Types.h"
#include "SWF/ShapeParser.h"
#include <cstdint>
#include <map>
#include <span>
#include <vector>

namespace MAP76::SWF
{
    /**
     * @brief An active display object placed on the virtual Flash display list at a specific depth.
     */
    struct DisplayObject
    {
        uint16_t characterId{0};
        Matrix2D matrix{};
        float alpha{1.0f};
    };

    /**
     * @brief Interprets Flash SWF sprite control tags (PlaceObject2, RemoveObject2, ShowFrame)
     *        and builds a linear, GPU-friendly timeline of pre-multiplied draw calls.
     */
    class TimelineParser
    {
    public:
        /**
         * @brief Parses a DefineSprite payload and generates its frame sequence.
         *
         * @param a_spriteData Raw byte payload of the DefineSprite tag.
         * @param a_shapes Dictionary of all shapes defined in the SWF, indexed by shapeId.
         * @param a_rootTransform The root transformation matrix assigned when this sprite was placed in the root timeline.
         * @param a_childSprites Optional map of pre-parsed child sprite timelines used to flatten nested sprites.
         * @return Vector of FrameData containing linear depth-sorted draw calls for each frame.
         */
        static std::vector<FrameData> ParseSprite(
            std::span<const uint8_t> a_spriteData,
            const std::map<uint16_t, ExtractedShape>& a_shapes,
            const Matrix2D& a_rootTransform,
            const std::map<uint16_t, std::vector<FrameData>>& a_childSprites = {}
        );
    };
}
