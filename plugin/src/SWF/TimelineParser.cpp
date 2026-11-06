#include "PCH.h"
#include "SWF/TimelineParser.h"

namespace
{
    using namespace MAP76::SWF;

    void AssembleFrameDrawCalls(
        const std::map<uint16_t, DisplayObject>& a_displayList,
        const std::map<uint16_t, ExtractedShape>& a_shapes,
        const std::map<uint16_t, std::vector<FrameData>>& a_childSprites,
        std::size_t a_currentFrameIndex,
        std::vector<DrawCall>& a_outCalls)
    {
        for (const auto& [depth, obj] : a_displayList) {
            if (auto shapeIt = a_shapes.find(obj.characterId); shapeIt != a_shapes.end()) {
                for (const auto& sub : shapeIt->second.subPaths) {
                    DrawCall call{};
                    call.p = sub.pathId;
                    call.f = sub.fill;
                    call.o = sub.opacity * obj.alpha;
                    call.t = obj.matrix;
                    a_outCalls.push_back(std::move(call));
                }
            } else if (auto childIt = a_childSprites.find(obj.characterId); childIt != a_childSprites.end()) {
                const auto& childFrames = childIt->second;
                if (!childFrames.empty()) {
                    const std::size_t childIdx = a_currentFrameIndex % childFrames.size();
                    const auto& childFrame = childFrames[childIdx];
                    for (const auto& childCall : childFrame.calls) {
                        DrawCall call{};
                        call.p = childCall.p;
                        call.f = childCall.f;
                        call.o = childCall.o * obj.alpha;
                        call.t = childCall.t ? obj.matrix.Multiply(*childCall.t) : obj.matrix;
                        a_outCalls.push_back(std::move(call));
                    }
                }
            }
        }
    }
}

namespace MAP76::SWF
{
    std::vector<FrameData> TimelineParser::ParseSprite(
        std::span<const uint8_t> a_spriteData,
        const std::map<uint16_t, ExtractedShape>& a_shapes,
        const Matrix2D& a_rootTransform,
        const std::map<uint16_t, std::vector<FrameData>>& a_childSprites)
    {
        std::vector<FrameData> frames;

        // A valid DefineSprite tag contains at least SpriteId (UI16) and FrameCount (UI16)
        if (a_spriteData.size() < 4) {
            return frames;
        }

        BitReader reader(a_spriteData);
        (void)reader.ReadUI16(); // SpriteId
        const uint16_t expectedFrameCount = reader.ReadUI16();
        frames.reserve(expectedFrameCount);

        std::map<uint16_t, DisplayObject> displayList;

        while (reader.BytesRemaining() >= 2) {
            const uint16_t tagCodeAndLength = reader.ReadUI16();
            const uint16_t tagCode = tagCodeAndLength >> 6;
            uint32_t tagLength = tagCodeAndLength & 0x3F;

            if (tagLength == 0x3F) {
                tagLength = reader.ReadUI32();
            }

            const std::size_t tagPayloadStart = reader.ByteOffset();
            const std::size_t tagPayloadEnd = tagPayloadStart + tagLength;

            const auto tagType = static_cast<TagType>(tagCode);
            if (tagType == TagType::End) {
                break;
            }

            switch (tagType) {
            case TagType::ShowFrame: {
                FrameData currentFrame{};
                currentFrame.t = a_rootTransform;
                AssembleFrameDrawCalls(displayList, a_shapes, a_childSprites, frames.size(), currentFrame.calls);
                frames.push_back(std::move(currentFrame));
                break;
            }

            case TagType::PlaceObject2: {
                const uint8_t flags = reader.ReadUI8();
                const uint16_t depth = reader.ReadUI16();

                const bool placeFlagMove      = (flags & 0x01) != 0;
                const bool hasCharacter       = (flags & 0x02) != 0;
                const bool hasMatrix          = (flags & 0x04) != 0;
                const bool hasColorTransform  = (flags & 0x08) != 0;
                const bool hasRatio           = (flags & 0x10) != 0;
                const bool hasName            = (flags & 0x20) != 0;
                const bool hasClipDepth       = (flags & 0x40) != 0;

                if (!placeFlagMove) {
                    displayList[depth] = DisplayObject{};
                }
                DisplayObject& obj = displayList[depth];

                if (hasCharacter) {
                    obj.characterId = reader.ReadUI16();
                }
                if (hasMatrix) {
                    obj.matrix = reader.ReadMatrix();
                }
                if (hasColorTransform) {
                    obj.alpha = reader.ReadColorTransform(true).ComputeFinalAlpha();
                }
                if (hasRatio) {
                    (void)reader.ReadUI16();
                }
                if (hasName) {
                    (void)reader.ReadString();
                }
                if (hasClipDepth) {
                    (void)reader.ReadUI16();
                }
                break;
            }

            case TagType::PlaceObject3: {
                const uint8_t flags1 = reader.ReadUI8();
                const uint8_t flags2 = reader.ReadUI8();

                const bool placeFlagMove      = (flags1 & 0x01) != 0;
                const bool hasCharacter       = (flags1 & 0x02) != 0;
                const bool hasMatrix          = (flags1 & 0x04) != 0;
                const bool hasColorTransform  = (flags1 & 0x08) != 0;
                const bool hasRatio           = (flags1 & 0x10) != 0;
                const bool hasName            = (flags1 & 0x20) != 0;
                const bool hasClipDepth       = (flags1 & 0x40) != 0;

                const bool hasClassName       = (flags2 & 0x08) != 0;
                const bool hasImage           = (flags2 & 0x10) != 0;

                const uint16_t depth = reader.ReadUI16();

                if (!placeFlagMove) {
                    displayList[depth] = DisplayObject{};
                }
                DisplayObject& obj = displayList[depth];

                if (hasClassName || (hasImage && hasCharacter)) {
                    (void)reader.ReadString();
                }
                if (hasCharacter) {
                    obj.characterId = reader.ReadUI16();
                }
                if (hasMatrix) {
                    obj.matrix = reader.ReadMatrix();
                }
                if (hasColorTransform) {
                    obj.alpha = reader.ReadColorTransform(true).ComputeFinalAlpha();
                }
                if (hasRatio) {
                    (void)reader.ReadUI16();
                }
                if (hasName) {
                    (void)reader.ReadString();
                }
                if (hasClipDepth) {
                    (void)reader.ReadUI16();
                }
                break;
            }

            case TagType::RemoveObject2: {
                const uint16_t depth = reader.ReadUI16();
                displayList.erase(depth);
                break;
            }

            case TagType::PlaceObject: {
                const uint16_t characterId = reader.ReadUI16();
                const uint16_t depth = reader.ReadUI16();
                const Matrix2D matrix = reader.ReadMatrix();
                displayList[depth] = DisplayObject{
                    .characterId = characterId,
                    .matrix = matrix,
                    .alpha = 1.0f
                };
                break;
            }

            case TagType::RemoveObject: {
                (void)reader.ReadUI16(); // CharacterId
                const uint16_t depth = reader.ReadUI16();
                displayList.erase(depth);
                break;
            }

            default:
                break;
            }

            if (reader.ByteOffset() < tagPayloadEnd) {
                reader.Seek(tagPayloadEnd);
            }
        }

        return frames;
    }
}
