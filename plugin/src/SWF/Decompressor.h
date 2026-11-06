#pragma once

#include <cstdint>
#include <optional>
#include <span>
#include <vector>

namespace MAP76::SWF
{
    /**
     * @brief Decompresses a raw Flash SWF binary stream (CWS or FWS).
     *
     * Flash SWF files use three signature formats:
     *   - 'FWS': Uncompressed Flash stream.
     *   - 'CWS': Zlib/Deflate compressed Flash stream (header bytes 0..7 uncompressed, payload from byte 8).
     *   - 'ZWS': LZMA compressed stream (rare in Fallout 4).
     *
     * This function transparently validates the signature, reads the expected uncompressed
     * file size, decompresses the payload using miniz, and returns a contiguous uncompressed
     * buffer starting with signature 'FWS'.
     */
    [[nodiscard]] std::optional<std::vector<uint8_t>> Decompress(std::span<const uint8_t> a_input);
}
