#include "PCH.h"
#include "SWF/ShapeParser.h"
#include <charconv>

namespace
{
    using namespace MAP76::SWF;

    std::string FormatCoord(float a_val)
    {
        char buffer[32];
        auto [ptr, ec] = std::to_chars(buffer, buffer + sizeof(buffer), a_val, std::chars_format::fixed, 2);
        std::string_view sv(buffer, ptr - buffer);

        // Strip trailing zeros after decimal point for compact SVG strings
        if (auto dotPos = sv.find('.'); dotPos != std::string_view::npos) {
            while (sv.ends_with('0')) {
                sv.remove_suffix(1);
            }
            if (sv.ends_with('.')) {
                sv.remove_suffix(1);
            }
        }
        return std::string(sv);
    }
}

namespace MAP76::SWF
{
    ExtractedShape ShapeParser::Parse(uint16_t a_tagType, BitReader& a_reader)
    {
        const auto tagType = static_cast<TagType>(a_tagType);

        ExtractedShape result{};
        result.shapeId = a_reader.ReadUI16();
        result.bounds = a_reader.ReadRect();

        if (tagType == TagType::DefineShape4) {
            (void)a_reader.ReadRect(); // EdgeBounds
            (void)a_reader.ReadBits(5); // Reserved
            (void)a_reader.ReadBits(1); // UsesFillWindingRule
            (void)a_reader.ReadBits(1); // UsesNonScalingStrokes
            (void)a_reader.ReadBits(1); // UsesScalingStrokes
        }

        // FillStyleArray
        std::vector<ColorRGBA> solidFills;
        uint16_t fillCount = a_reader.ReadUI8();
        if (tagType != TagType::DefineShape && fillCount == 0xFF) {
            fillCount = a_reader.ReadUI16();
        }

        for (uint16_t i = 0; i < fillCount; ++i) {
            const uint8_t fillType = a_reader.ReadUI8();
            if (fillType == 0x00) {
                if (tagType == TagType::DefineShape || tagType == TagType::DefineShape2) {
                    solidFills.push_back(a_reader.ReadRGB());
                } else {
                    solidFills.push_back(a_reader.ReadRGBA());
                }
            } else if (fillType == 0x10 || fillType == 0x12 || fillType == 0x13) {
                (void)a_reader.ReadMatrix();
                a_reader.AlignByte();
                const uint8_t numGradients = a_reader.ReadUI8() & 0x0F;
                for (uint8_t g = 0; g < numGradients; ++g) {
                    (void)a_reader.ReadUI8(); // Ratio
                    if (tagType == TagType::DefineShape3 || tagType == TagType::DefineShape4) {
                        (void)a_reader.ReadRGBA();
                    } else {
                        (void)a_reader.ReadRGB();
                    }
                }
                if (fillType == 0x13) {
                    (void)a_reader.ReadSI16(); // FocalPoint
                }
            } else if (fillType >= 0x40 && fillType <= 0x43) {
                (void)a_reader.ReadUI16(); // BitmapId
                (void)a_reader.ReadMatrix();
            }
        }

        const std::size_t numFills = std::max<std::size_t>(1, solidFills.size());
        struct PathBuilder
        {
            std::string svgPath;
            float lastPenX{0.0f};
            float lastPenY{0.0f};
            bool hasPen{false};

            void AppendEdge(float a_startX, float a_startY, const std::string& a_cmd, float a_endX, float a_endY)
            {
                if (!hasPen || lastPenX != a_startX || lastPenY != a_startY) {
                    if (!svgPath.empty()) {
                        svgPath += " ";
                    }
                    svgPath += "M" + FormatCoord(a_startX) + " " + FormatCoord(a_startY);
                }
                if (!svgPath.empty()) {
                    svgPath += " ";
                }
                svgPath += a_cmd;
                lastPenX = a_endX;
                lastPenY = a_endY;
                hasPen = true;
            }
        };

        std::vector<PathBuilder> builders(numFills);

        // LineStyleArray
        uint16_t lineCount = a_reader.ReadUI8();
        if (tagType != TagType::DefineShape && lineCount == 0xFF) {
            lineCount = a_reader.ReadUI16();
        }

        for (uint16_t i = 0; i < lineCount; ++i) {
            if (tagType == TagType::DefineShape4) {
                (void)a_reader.ReadUI16(); // Width
                const uint16_t flags = a_reader.ReadUI16();
                const bool hasFill = (flags & 0x08) != 0;
                if (!hasFill) {
                    (void)a_reader.ReadRGBA();
                } else {
                    (void)a_reader.ReadUI8();
                }
            } else {
                (void)a_reader.ReadUI16(); // Width
                if (tagType == TagType::DefineShape3) {
                    (void)a_reader.ReadRGBA();
                } else {
                    (void)a_reader.ReadRGB();
                }
            }
        }

        // ShapeRecords
        a_reader.AlignByte();
        uint8_t numFillBits = static_cast<uint8_t>(a_reader.ReadBits(4));
        uint8_t numLineBits = static_cast<uint8_t>(a_reader.ReadBits(4));

        float currX = 0.0f;
        float currY = 0.0f;
        uint16_t fillStyle0 = 0;
        uint16_t fillStyle1 = 0;

        while (a_reader.HasRemaining()) {
            const bool typeFlag = a_reader.ReadBits(1) != 0;

            if (!typeFlag) {
                // Non-edge record (StyleChangeRecord or EndShapeRecord)
                // In Flash SWF, all shape tags (DefineShape 1..4) declare 5 flag bits following TypeFlag=0.
                // In DefineShape (tag 2), StateNewStyles is unused, but the 5th bit MUST still be read
                // to maintain bitstream alignment for subsequent fields and edge records.
                const bool stateNewStyles  = a_reader.ReadBits(1) != 0;
                const bool stateLineStyle  = a_reader.ReadBits(1) != 0;
                const bool stateFillStyle1 = a_reader.ReadBits(1) != 0;
                const bool stateFillStyle0 = a_reader.ReadBits(1) != 0;
                const bool stateMoveTo     = a_reader.ReadBits(1) != 0;

                // EndShapeRecord: all state bits are 0
                if (!stateNewStyles && !stateLineStyle && !stateFillStyle1 && !stateFillStyle0 && !stateMoveTo) {
                    break;
                }

                if (stateMoveTo) {
                    const uint8_t moveBits = static_cast<uint8_t>(a_reader.ReadBits(5));
                    currX = a_reader.ReadTwips(moveBits);
                    currY = a_reader.ReadTwips(moveBits);
                }

                if (stateFillStyle0) {
                    fillStyle0 = static_cast<uint16_t>(a_reader.ReadBits(numFillBits));
                }
                if (stateFillStyle1) {
                    fillStyle1 = static_cast<uint16_t>(a_reader.ReadBits(numFillBits));
                }
                if (stateLineStyle) {
                    (void)a_reader.ReadBits(numLineBits);
                }

                if (stateNewStyles) {
                    uint16_t newFillCount = a_reader.ReadUI8();
                    if (newFillCount == 0xFF) {
                        newFillCount = a_reader.ReadUI16();
                    }
                    for (uint16_t f = 0; f < newFillCount; ++f) {
                        const uint8_t ft = a_reader.ReadUI8();
                        if (ft == 0x00) {
                            if (tagType == TagType::DefineShape2) (void)a_reader.ReadRGB(); else (void)a_reader.ReadRGBA();
                        }
                    }

                    uint16_t newLineCount = a_reader.ReadUI8();
                    if (newLineCount == 0xFF) {
                        newLineCount = a_reader.ReadUI16();
                    }
                    for (uint16_t l = 0; l < newLineCount; ++l) {
                        (void)a_reader.ReadUI16();
                        if (tagType == TagType::DefineShape3 || tagType == TagType::DefineShape4) {
                            (void)a_reader.ReadRGBA();
                        } else {
                            (void)a_reader.ReadRGB();
                        }
                    }

                    a_reader.AlignByte();
                    numFillBits = static_cast<uint8_t>(a_reader.ReadBits(4));
                    numLineBits = static_cast<uint8_t>(a_reader.ReadBits(4));
                }
            } else {
                // Edge record: straight line or quadratic curve
                const bool straightFlag = a_reader.ReadBits(1) != 0;
                const uint8_t numBits = static_cast<uint8_t>(a_reader.ReadBits(4)) + 2;

                const float startX = currX;
                const float startY = currY;
                float endX = startX;
                float endY = startY;
                std::string edgeCmd;

                if (straightFlag) {
                    const bool generalLineFlag = a_reader.ReadBits(1) != 0;
                    float deltaX = 0.0f;
                    float deltaY = 0.0f;

                    if (generalLineFlag) {
                        deltaX = a_reader.ReadTwips(numBits);
                        deltaY = a_reader.ReadTwips(numBits);
                    } else {
                        const bool vertLineFlag = a_reader.ReadBits(1) != 0;
                        if (vertLineFlag) {
                            deltaY = a_reader.ReadTwips(numBits);
                        } else {
                            deltaX = a_reader.ReadTwips(numBits);
                        }
                    }

                    endX = startX + deltaX;
                    endY = startY + deltaY;
                    edgeCmd = "L" + FormatCoord(endX) + " " + FormatCoord(endY);
                } else {
                    const float controlDeltaX = a_reader.ReadTwips(numBits);
                    const float controlDeltaY = a_reader.ReadTwips(numBits);
                    const float anchorDeltaX  = a_reader.ReadTwips(numBits);
                    const float anchorDeltaY  = a_reader.ReadTwips(numBits);

                    const float controlX = startX + controlDeltaX;
                    const float controlY = startY + controlDeltaY;
                    endX = controlX + anchorDeltaX;
                    endY = controlY + anchorDeltaY;

                    edgeCmd = "Q" + FormatCoord(controlX) + " " + FormatCoord(controlY) + " " +
                               FormatCoord(endX) + " " + FormatCoord(endY);
                }

                currX = endX;
                currY = endY;

                if (numFills <= 1) {
                    builders[0].AppendEdge(startX, startY, edgeCmd, endX, endY);
                } else {
                    for (std::size_t k = 1; k <= numFills; ++k) {
                        if (fillStyle0 == k || fillStyle1 == k) {
                            builders[k - 1].AppendEdge(startX, startY, edgeCmd, endX, endY);
                        }
                    }
                }
            }
        }

        // Emit partitioned subpaths
        for (std::size_t i = 0; i < numFills; ++i) {
            if (!builders[i].svgPath.empty()) {
                builders[i].svgPath += " Z";

                std::string pathId = (numFills == 1)
                    ? ("s" + std::to_string(result.shapeId))
                    : ("s" + std::to_string(result.shapeId) + "_f" + std::to_string(i + 1));

                std::string fillColor = "#ffffff";
                float opacity = 1.0f;

                if (i < solidFills.size()) {
                    fillColor = solidFills[i].ToHex();
                    opacity = solidFills[i].Opacity();
                }

                result.subPaths.push_back(ShapeSubPath{
                    .pathId = std::move(pathId),
                    .svgPath = std::move(builders[i].svgPath),
                    .fill = std::move(fillColor),
                    .opacity = opacity
                });
            }
        }

        return result;
    }
}
