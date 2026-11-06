# Building MAP76

This guide covers the prerequisites and build procedures for both the C++ native plugin (`plugin/`) and the map interface view (`view/`).

---

## Prerequisites

### 1. General
- **Git**.

### 2. C++ Plugin (`plugin/`)
- **[xmake](https://xmake.io/)** (build system).
- **MSVC Toolchain & Windows SDK**:
  - Windows: Visual Studio with MSVC v143+ and Windows 10/11 SDK.
  - Linux: Cross-compilation via `msvc-wine` (supported natively by `xmake.lua`).
- **Prisma UI Flat API Header**:
  - The header file `PrismaUI_F4_Modern_API.h` is required for compilation and is excluded from git tracking.
  - Obtain `PrismaUI_F4_Modern_API.h` from the [NomadsReach/framework-F4-Conversion](https://github.com/NomadsReach/framework-F4-Conversion/) repository and place it directly into `plugin/src/` before building.
- **miniz (Zlib Decompression)**:
  - The single-source compression library files `miniz.c` and `miniz.h` are required by the SWF vector decompression engine and are excluded from git tracking.
  - Download `miniz.c` and `miniz.h` from the [richgel999/miniz](https://github.com/richgel999/miniz) repository and place them into `plugin/src/SWF/` before building.

### 3. Map View (`view/`)
- **[Node.js](https://nodejs.org/)** (v18 or newer) and **npm**.

---

## Building the C++ Plugin

1. **Initialize Git Submodules**:
   Ensure `plugin/lib/commonlibf4` is populated:
   ```bash
   git submodule update --init --recursive
   ```

2. **Configure the Project**:

   - **On Windows:**
     ```bash
     cd plugin
     xmake f -p windows -a x64 --toolchain=msvc -m release
     ```

   - **On Linux (using `msvc-wine`):**
     ```bash
     cd plugin
     xmake f -p windows -a x64 --toolchain=msvc --sdk=~/msvc-wine -m release
     ```

3. **Build the Plugin**:
   ```bash
   xmake
   ```

   Upon a successful build, `MAP76.dll` is generated in `plugin/build/windows/x64/release/`.

---

## Building the Map View

1. **Install Dependencies**:
   ```bash
   cd view
   npm install
   ```

2. **Provide Assets**:
   Ensure required map textures, fonts, and icons are present in `view/public/assets/`.

3. **Build the Distribution Bundle**:
   ```bash
   npx vite build
   ```

   Upon completion, the compiled interface files will be output to `view/dist/`.

---

## Game Deployment Paths

To test or install your custom build in Fallout 4:

| Component | Source Path | Target Game Directory |
| :--- | :--- | :--- |
| **Plugin DLL** | `plugin/build/windows/x64/release/MAP76.dll` | `Data/F4SE/Plugins/` |
| **Map View** | `view/dist/*` | `Data/PrismaUI_F4/views/MAP76/` |
| **Translations** | `view/locales/MAP76_Plugin_*.json` | `Data/Interface/Translations/` |
