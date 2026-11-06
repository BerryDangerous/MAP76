#include "PCH.h"
#include "SWF/Decompressor.h"

#define MINIZ_NO_STDIO
#define MINIZ_NO_ARCHIVE_APIS
#define MINIZ_NO_TIME
#include "SWF/miniz.h"
#include "SWF/miniz.c"

#include <cstring>
#include <string_view>

namespace MAP76::SWF
{
    namespace
    {
        inline constexpr std::size_t HEADER_PREFIX_SIZE = 8;
        inline constexpr std::size_t ZLIB_STREAM_OFFSET = 8;
        inline constexpr uint32_t MAX_DECOMPRESSED_SWF_SIZE = 64 * 1024 * 1024; // 64 MB sanity limit
    }

    std::optional<std::vector<uint8_t>> Decompress(std::span<const uint8_t> a_input)
    {
        if (a_input.size() < HEADER_PREFIX_SIZE) {
            REX::ERROR("MAP76::SWF: Input buffer too small for SWF header prefix ({} bytes).", a_input.size());
            return std::nullopt;
        }

        const std::string_view signature(reinterpret_cast<const char*>(a_input.data()), 3);

        uint32_t uncompressedLength = 0;
        std::memcpy(&uncompressedLength, a_input.data() + 4, sizeof(uint32_t));

        if (uncompressedLength < HEADER_PREFIX_SIZE || uncompressedLength > MAX_DECOMPRESSED_SWF_SIZE) {
            REX::ERROR("MAP76::SWF: Invalid or unreasonable uncompressed length ({} bytes).", uncompressedLength);
            return std::nullopt;
        }

        if (signature == "FWS") {
            return std::vector<uint8_t>(a_input.begin(), a_input.end());
        }

        if (signature == "CWS") {
            std::vector<uint8_t> output(uncompressedLength);

            // Copy the uncompressed prefix (Signature, Version, FileLength)
            std::memcpy(output.data(), a_input.data(), HEADER_PREFIX_SIZE);
            // Downstream parsers expect 'FWS' signature for uncompressed data
            output[0] = 'F';

            auto compressedPayload = a_input.subspan(ZLIB_STREAM_OFFSET);
            auto decompressedPayload = std::span(output).subspan(ZLIB_STREAM_OFFSET);

            mz_ulong destLen = static_cast<mz_ulong>(decompressedPayload.size());
            const int status = mz_uncompress(
                decompressedPayload.data(),
                &destLen,
                compressedPayload.data(),
                static_cast<mz_ulong>(compressedPayload.size())
            );

            if (status != MZ_OK) {
                REX::ERROR("MAP76::SWF: miniz uncompress failed with error code: {}", status);
                return std::nullopt;
            }

            output.resize(HEADER_PREFIX_SIZE + destLen);
            return output;
        }

        REX::ERROR("MAP76::SWF: Unsupported SWF signature '{}'.", signature);
        return std::nullopt;
    }
}
