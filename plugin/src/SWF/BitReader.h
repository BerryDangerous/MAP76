#pragma once

#include "SWF/Types.h"
#include <cstdint>
#include <span>
#include <string>

namespace MAP76::SWF
{
    /**
     * @brief A bit-level and byte-level stream reader for Flash SWF payloads.
     *
     * Flash SWF packs binary data densely at the bit level using Most Significant Bit (MSB) first.
     * Coordinate structures (such as RECT and MATRIX) and shape drawing records rely on signed
     * bitfields of arbitrary widths (from 1 bit up to 32 bits).
     */
    class BitReader
    {
    public:
        explicit BitReader(std::span<const uint8_t> a_buffer);

        // --- Stream Position and State ---
        [[nodiscard]] std::size_t ByteOffset() const noexcept { return _byteIndex; }
        [[nodiscard]] std::size_t BytesRemaining() const noexcept;
        [[nodiscard]] bool HasRemaining() const noexcept;
        void Seek(std::size_t a_byteOffset);
        void AlignByte() noexcept;

        static constexpr float TWIPS_PER_PIXEL = 20.0f;
        static constexpr float FIXED_16_16_SCALE = 65536.0f;

        [[nodiscard]] uint32_t ReadBits(uint8_t a_count);
        [[nodiscard]] int32_t ReadSignedBits(uint8_t a_count);

        /** Reads signed bits and converts from 16.16 fixed-point to float. */
        [[nodiscard]] float ReadFixed16(uint8_t a_count)
        {
            return static_cast<float>(ReadSignedBits(a_count)) / FIXED_16_16_SCALE;
        }

        /** Reads signed bits and converts from Flash twips to pixels (twips / 20). */
        [[nodiscard]] float ReadTwips(uint8_t a_count)
        {
            return static_cast<float>(ReadSignedBits(a_count)) / TWIPS_PER_PIXEL;
        }

        // --- Byte-Level Numerical Reading (Little-Endian) ---
        [[nodiscard]] uint8_t ReadUI8();
        [[nodiscard]] uint16_t ReadUI16();
        [[nodiscard]] uint32_t ReadUI32();
        [[nodiscard]] int16_t ReadSI16();

        // --- SWF High-Level Structures ---
        [[nodiscard]] Rect ReadRect();
        [[nodiscard]] Matrix2D ReadMatrix();
        [[nodiscard]] ColorRGBA ReadRGB();
        [[nodiscard]] ColorRGBA ReadRGBA();
        [[nodiscard]] ColorTransform ReadColorTransform(bool a_hasAlpha);
        [[nodiscard]] std::string ReadString();

        // --- Sub-span creation ---
        [[nodiscard]] std::span<const uint8_t> ReadBytes(std::size_t a_count);

    private:
        std::span<const uint8_t> _buffer;
        std::size_t _byteIndex{0};
        uint8_t _bitBuffer{0};
        uint8_t _bitsRemainingInByte{0};
    };
}
