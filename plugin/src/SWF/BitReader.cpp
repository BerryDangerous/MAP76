#include "PCH.h"
#include "SWF/BitReader.h"

#include <algorithm>
#include <stdexcept>

namespace MAP76::SWF
{
    BitReader::BitReader(std::span<const uint8_t> a_buffer) :
        _buffer(a_buffer)
    {}

    std::size_t BitReader::BytesRemaining() const noexcept
    {
        return _byteIndex < _buffer.size() ? _buffer.size() - _byteIndex : 0;
    }

    bool BitReader::HasRemaining() const noexcept
    {
        return _byteIndex < _buffer.size() || _bitsRemainingInByte > 0;
    }

    void BitReader::Seek(std::size_t a_byteOffset)
    {
        _byteIndex = std::min(a_byteOffset, _buffer.size());
        _bitBuffer = 0;
        _bitsRemainingInByte = 0;
    }

    void BitReader::AlignByte() noexcept
    {
        _bitsRemainingInByte = 0;
        _bitBuffer = 0;
    }

    uint32_t BitReader::ReadBits(uint8_t a_count)
    {
        if (a_count == 0) {
            return 0;
        }

        uint32_t result = 0;
        while (a_count > 0) {
            if (_bitsRemainingInByte == 0) {
                if (_byteIndex >= _buffer.size()) {
                    return a_count >= 32 ? 0 : (result << a_count); // Reached EOF gracefully
                }
                _bitBuffer = _buffer[_byteIndex++];
                _bitsRemainingInByte = 8;
            }

            const uint8_t bitsToTake = std::min(a_count, _bitsRemainingInByte);
            const uint8_t shift = _bitsRemainingInByte - bitsToTake;
            const uint8_t mask = static_cast<uint8_t>((1U << bitsToTake) - 1);
            const uint8_t extracted = (_bitBuffer >> shift) & mask;

            result = (result << bitsToTake) | extracted;
            _bitsRemainingInByte -= bitsToTake;
            a_count -= bitsToTake;
        }

        return result;
    }

    int32_t BitReader::ReadSignedBits(uint8_t a_count)
    {
        if (a_count == 0) {
            return 0;
        }

        int32_t value = static_cast<int32_t>(ReadBits(a_count));
        // Perform sign extension if the sign bit (MSB) is set
        if (a_count < 32 && (value & (1U << (a_count - 1)))) {
            value |= ~((1U << a_count) - 1);
        }
        return value;
    }

    uint8_t BitReader::ReadUI8()
    {
        AlignByte();
        if (_byteIndex >= _buffer.size()) {
            return 0;
        }
        return _buffer[_byteIndex++];
    }

    uint16_t BitReader::ReadUI16()
    {
        AlignByte();
        if (_byteIndex + 2 > _buffer.size()) {
            return 0;
        }
        const uint16_t val = static_cast<uint16_t>(_buffer[_byteIndex]) |
                            (static_cast<uint16_t>(_buffer[_byteIndex + 1]) << 8);
        _byteIndex += 2;
        return val;
    }

    uint32_t BitReader::ReadUI32()
    {
        AlignByte();
        if (_byteIndex + 4 > _buffer.size()) {
            return 0;
        }
        const uint32_t val = static_cast<uint32_t>(_buffer[_byteIndex]) |
                            (static_cast<uint32_t>(_buffer[_byteIndex + 1]) << 8) |
                            (static_cast<uint32_t>(_buffer[_byteIndex + 2]) << 16) |
                            (static_cast<uint32_t>(_buffer[_byteIndex + 3]) << 24);
        _byteIndex += 4;
        return val;
    }

    int16_t BitReader::ReadSI16()
    {
        return static_cast<int16_t>(ReadUI16());
    }

    Rect BitReader::ReadRect()
    {
        AlignByte();
        const uint8_t nBits = static_cast<uint8_t>(ReadBits(5));
        if (nBits == 0) {
            AlignByte();
            return Rect{};
        }

        Rect rect{
            .xMinTwips = ReadSignedBits(nBits),
            .xMaxTwips = ReadSignedBits(nBits),
            .yMinTwips = ReadSignedBits(nBits),
            .yMaxTwips = ReadSignedBits(nBits)
        };

        AlignByte();
        return rect;
    }

    Matrix2D BitReader::ReadMatrix()
    {
        AlignByte();

        Matrix2D mat{};

        const bool hasScale = ReadBits(1) != 0;
        if (hasScale) {
            const uint8_t nScaleBits = static_cast<uint8_t>(ReadBits(5));
            mat.a = ReadFixed16(nScaleBits);
            mat.d = ReadFixed16(nScaleBits);
        } else {
            mat.a = 1.0f;
            mat.d = 1.0f;
        }

        const bool hasRotate = ReadBits(1) != 0;
        if (hasRotate) {
            const uint8_t nRotateBits = static_cast<uint8_t>(ReadBits(5));
            mat.b = ReadFixed16(nRotateBits);
            mat.c = ReadFixed16(nRotateBits);
        } else {
            mat.b = 0.0f;
            mat.c = 0.0f;
        }

        const uint8_t nTranslateBits = static_cast<uint8_t>(ReadBits(5));
        if (nTranslateBits > 0) {
            mat.tx = ReadTwips(nTranslateBits);
            mat.ty = ReadTwips(nTranslateBits);
        } else {
            mat.tx = 0.0f;
            mat.ty = 0.0f;
        }

        AlignByte();
        return mat;
    }

    ColorRGBA BitReader::ReadRGB()
    {
        AlignByte();
        if (_byteIndex + 3 > _buffer.size()) {
            return ColorRGBA{};
        }
        ColorRGBA col{
            .r = _buffer[_byteIndex++],
            .g = _buffer[_byteIndex++],
            .b = _buffer[_byteIndex++],
            .a = 255
        };
        return col;
    }

    ColorRGBA BitReader::ReadRGBA()
    {
        AlignByte();
        if (_byteIndex + 4 > _buffer.size()) {
            return ColorRGBA{};
        }
        ColorRGBA col{
            .r = _buffer[_byteIndex++],
            .g = _buffer[_byteIndex++],
            .b = _buffer[_byteIndex++],
            .a = _buffer[_byteIndex++]
        };
        return col;
    }

    ColorTransform BitReader::ReadColorTransform(bool a_hasAlpha)
    {
        AlignByte();
        ColorTransform ct{};

        const bool hasAdd = ReadBits(1) != 0;
        const bool hasMult = ReadBits(1) != 0;
        const uint8_t nBits = static_cast<uint8_t>(ReadBits(4));

        if (hasMult && nBits > 0) {
            // Flash stores multiplier terms as fixed 8.8 (divide by 256.0f)
            (void)ReadSignedBits(nBits); // rMult
            (void)ReadSignedBits(nBits); // gMult
            (void)ReadSignedBits(nBits); // bMult
            if (a_hasAlpha) {
                ct.alphaMult = static_cast<float>(ReadSignedBits(nBits)) / 256.0f;
            }
        }

        if (hasAdd && nBits > 0) {
            (void)ReadSignedBits(nBits); // rAdd
            (void)ReadSignedBits(nBits); // gAdd
            (void)ReadSignedBits(nBits); // bAdd
            if (a_hasAlpha) {
                ct.alphaAdd = static_cast<float>(ReadSignedBits(nBits)) / 255.0f;
            }
        }

        AlignByte();
        return ct;
    }

    std::string BitReader::ReadString()
    {
        AlignByte();
        std::string str;
        while (_byteIndex < _buffer.size()) {
            const char ch = static_cast<char>(_buffer[_byteIndex++]);
            if (ch == '\0') {
                break;
            }
            str.push_back(ch);
        }
        return str;
    }

    std::span<const uint8_t> BitReader::ReadBytes(std::size_t a_count)
    {
        AlignByte();
        const std::size_t available = std::min(a_count, BytesRemaining());
        std::span<const uint8_t> result = _buffer.subspan(_byteIndex, available);
        _byteIndex += available;
        return result;
    }
}
