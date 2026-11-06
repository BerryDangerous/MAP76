#include "PCH.h"
#include "SWF/Extractor.h"
#include "SWF/BitReader.h"
#include "SWF/Decompressor.h"
#include "SWF/ShapeParser.h"
#include "SWF/TimelineParser.h"

#include <map>

namespace
{
    using namespace MAP76::SWF;

    uint16_t FindPrimarySpriteId(const std::map<uint16_t, uint16_t>& a_frameCounts) noexcept
    {
        uint16_t mainSpriteId = 0;
        uint16_t maxFrames = 0;
        for (const auto& [sid, fCount] : a_frameCounts) {
            if (fCount > maxFrames) {
                maxFrames = fCount;
                mainSpriteId = sid;
            }
        }
        return mainSpriteId;
    }

    std::map<std::string, std::string> BuildPathDictionary(const std::map<uint16_t, ExtractedShape>& a_shapes)
    {
        std::map<std::string, std::string> paths;
        for (const auto& [shapeId, shape] : a_shapes) {
            for (const auto& sub : shape.subPaths) {
                paths[sub.pathId] = sub.svgPath;
            }
        }
        return paths;
    }

    std::map<uint16_t, std::vector<FrameData>> ParseChildSprites(
        const std::map<uint16_t, std::span<const uint8_t>>& a_spritePayloads,
        uint16_t a_mainSpriteId,
        const std::map<uint16_t, ExtractedShape>& a_shapes)
    {
        std::map<uint16_t, std::vector<FrameData>> childSpriteFrames;
        for (const auto& [sid, payload] : a_spritePayloads) {
            if (sid != a_mainSpriteId) {
                childSpriteFrames[sid] = TimelineParser::ParseSprite(
                    payload,
                    a_shapes,
                    Matrix2D{},
                    childSpriteFrames
                );
            }
        }
        return childSpriteFrames;
    }
}

namespace MAP76::SWF
{
    std::optional<VaultBoyAnimationData> Extractor::Extract(std::span<const uint8_t> a_rawSwf)
    {
        auto uncompressed = Decompress(a_rawSwf);
        if (!uncompressed || uncompressed->size() < 8) {
            REX::ERROR("MAP76::SWF: Failed to decompress SWF stream.");
            return std::nullopt;
        }

        BitReader reader(*uncompressed);
        reader.Seek(8);

        const Rect frameSize = reader.ReadRect();
        const float stageWidth = frameSize.Width();
        const float stageHeight = frameSize.Height();

        (void)reader.ReadUI16();
        (void)reader.ReadUI16();

        std::map<uint16_t, ExtractedShape> shapes;
        std::map<uint16_t, std::span<const uint8_t>> spritePayloads;
        std::map<uint16_t, uint16_t> spriteFrameCounts;
        std::map<uint16_t, Matrix2D> rootPlacedCharacters;

        while (reader.BytesRemaining() >= 2) {
            const uint16_t tagCodeAndLength = reader.ReadUI16();
            const uint16_t tagCode = tagCodeAndLength >> 6;
            uint32_t tagLength = tagCodeAndLength & 0x3F;

            if (tagLength == 0x3F) {
                tagLength = reader.ReadUI32();
            }

            const std::size_t payloadStart = reader.ByteOffset();
            const std::size_t payloadEnd = payloadStart + tagLength;

            const auto tagType = static_cast<TagType>(tagCode);
            if (tagType == TagType::End) {
                break;
            }

            if (IsShapeTag(tagCode)) {
                auto shapeBytes = reader.ReadBytes(tagLength);
                BitReader shapeReader(shapeBytes);
                ExtractedShape shape = ShapeParser::Parse(tagCode, shapeReader);

                if (shape.shapeId != 0 && !shape.subPaths.empty()) {
                    shapes[shape.shapeId] = std::move(shape);
                }
            } else if (tagType == TagType::DefineSprite) {
                auto payloadSpan = reader.ReadBytes(tagLength);
                if (payloadSpan.size() >= 4) {
                    const uint16_t spriteId = static_cast<uint16_t>(payloadSpan[0]) |
                                             (static_cast<uint16_t>(payloadSpan[1]) << 8);
                    const uint16_t spriteFrames = static_cast<uint16_t>(payloadSpan[2]) |
                                                 (static_cast<uint16_t>(payloadSpan[3]) << 8);

                    spritePayloads[spriteId] = payloadSpan;
                    spriteFrameCounts[spriteId] = spriteFrames;
                }
            } else if (tagType == TagType::PlaceObject2) {
                const uint8_t flags = reader.ReadUI8();
                (void)reader.ReadUI16(); // Depth

                uint16_t charId = 0;
                Matrix2D mat{};

                const bool hasCharacter = (flags & 0x02) != 0;
                const bool hasMatrix    = (flags & 0x04) != 0;

                if (hasCharacter) {
                    charId = reader.ReadUI16();
                }
                if (hasMatrix) {
                    mat = reader.ReadMatrix();
                }
                if (charId != 0) {
                    rootPlacedCharacters[charId] = mat;
                }
            } else if (tagType == TagType::PlaceObject3) {
                const uint8_t flags1 = reader.ReadUI8();
                const uint8_t flags2 = reader.ReadUI8();
                (void)reader.ReadUI16(); // Depth

                const bool hasCharacter = (flags1 & 0x02) != 0;
                const bool hasMatrix    = (flags1 & 0x04) != 0;
                const bool hasClassName = (flags2 & 0x08) != 0;
                const bool hasImage     = (flags2 & 0x10) != 0;

                if (hasClassName || (hasImage && hasCharacter)) {
                    (void)reader.ReadString();
                }

                uint16_t charId = 0;
                Matrix2D mat{};

                if (hasCharacter) {
                    charId = reader.ReadUI16();
                }
                if (hasMatrix) {
                    mat = reader.ReadMatrix();
                }
                if (charId != 0) {
                    rootPlacedCharacters[charId] = mat;
                }
            }

            reader.Seek(payloadEnd);
        }

        const uint16_t mainSpriteId = FindPrimarySpriteId(spriteFrameCounts);
        if (mainSpriteId == 0 || !spritePayloads.contains(mainSpriteId)) {
            REX::WARN("MAP76::SWF: No valid animated DefineSprite found in SWF.");
            return std::nullopt;
        }

        Matrix2D rootPlacedMatrix{};
        if (rootPlacedCharacters.contains(mainSpriteId)) {
            rootPlacedMatrix = rootPlacedCharacters[mainSpriteId];
        } else if (!rootPlacedCharacters.empty()) {
            rootPlacedMatrix = rootPlacedCharacters.begin()->second;
        }

        std::map<std::string, std::string> paths = BuildPathDictionary(shapes);
        std::map<uint16_t, std::vector<FrameData>> childSpriteFrames = ParseChildSprites(spritePayloads, mainSpriteId, shapes);

        std::vector<FrameData> frames = TimelineParser::ParseSprite(
            spritePayloads[mainSpriteId],
            shapes,
            rootPlacedMatrix,
            childSpriteFrames
        );

        VaultBoyAnimationData result{};
        result.width = stageWidth > 0.0f ? stageWidth : DEFAULT_STAGE_WIDTH;
        result.height = stageHeight > 0.0f ? stageHeight : DEFAULT_STAGE_HEIGHT;
        result.paths = std::move(paths);
        result.frames = std::move(frames);

        return result;
    }
}
