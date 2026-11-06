# MAP76

MAP76 is an interactive, full-screen map interface mod for Fallout 4 built with Prisma UI, designed to make navigation, quest management, and settlement tracking more intuitive and feature-rich than the vanilla Pip-Boy map, with a visual style inspired by Fallout 76.

The mod pairs a F4SE plugin with an in-game UI overlay rendered by Prisma UI.

---

## Key Features

- **Cross-Worldspace Navigation & Fast Travel**: View and switch between worldspaces from anywhere, enabling cross-worldspace fast travel.
- **Quest Log & Objective Tracking**: View active and inactive quests with journal entries and objectives. Toggle active quests or isolate a single quest marker, and center the camera on quest objectives.
- **Animated Quest Vault Boys**: Seamlessly extracts and renders iconic Pip-Boy animated Vault Boy illustrations directly from game archives in real-time.
- **Locations & Workshop Management**: A unified Locations panel displaying settlements, raider outposts, vassals, VR workshops, and favorited locations, with settlement stats and visible supply lines drawn on the map.
- **Search**: Quickly search for specific landmarks, settlements, or quests.
- **Player Set Marker**: Place and manage the player set marker.
- **Gamepad & Keyboard Navigation**: Full controller and keyboard support, featuring virtual pointer panning via the right thumbstick, trigger-based continuous zoom, and D-pad panel navigation.
- **Customizable Textures & Icons**: Config-driven architecture allowing custom worldspace map textures (PNG, WebP, SVG) and Form-ID-based map marker icon overrides.
- **Favorites System**: Save favorite locations with persistence stored in `.f4se` co-save files.
- **Game Language Integration**: Automatically matches the game's configured language from `Fallout4.ini` via Prisma UI localization.

---

## Default Controls

| Action | Keyboard / Mouse | Gamepad |
| :--- | :--- | :--- |
| **Open Map** | `M` | `Menu` / `Options` |
| **Close Map** | `M` | `B` / `Back` |
| **Pan Map** | Mouse Drag | Right Thumbstick |
| **Zoom In / Out** | Mouse Wheel / `+`, `-` | Triggers (`RT` / `LT`) |
| **Switch Worldspace** | `<` and `>` | Bumpers (`LB` / `RB`) |
| **Center on Player** | `Space` | Click Left Stick (`LS`) |
| **Center on Quest Objective** | `Space` (with quest selected) | Click Left Stick (`LS`) |
| **Place / Move Marker** | `Enter` | `A` |
| **Navigate Panels** | Arrow Keys | D-Pad |
| **Open Settings** | `Z` | `Y` |
| **Open Game Menu** | `Esc` | `Start` |
| **Toggle Active Quest** | `T` | `X` |
| **Toggle Supply Lines** | `C` | `X` |

---

## Repository Structure

This repository is organized as a unified monorepo:

- **`plugin/`**: F4SE plugin, utilizing CommonLibF4 and the Prisma UI API.
- **`view/`**: Map interface overlay built with TypeScript, Vite, and tailored for the Ultralight WebKit runtime.

---

## Assets Notice

Map textures, icons, and fonts are not included in this repository. 

For development and testing, place the required assets into `view/public/assets/`.

---

## Runtime Requirements

To use this mod in Fallout 4, the following dependencies are required:

1. **Fallout 4**
2. **[Fallout 4 Script Extender (F4SE)](https://f4se.silverlock.org/)**
3. **[Address Library for F4SE](https://www.nexusmods.com/fallout4/mods/47327)**
4. **[Prisma UI Framework](https://www.nexusmods.com/fallout4/mods/105454)**

---

## Building from Source

Detailed prerequisites, configuration steps, and compilation procedures for both the C++ plugin and the map view are documented in [BUILDING.md](BUILDING.md).

---

## License

This project utilizes independent licenses across its two components:

- **`plugin/`**: Licensed under the **GNU General Public License v3.0 or later** ([GPL-3.0-or-later](plugin/LICENSE)), inheriting the standard CommonLib modding exception ([EXCEPTIONS](plugin/EXCEPTIONS)).
- **`view/`**: Licensed under the **GNU Affero General Public License v3.0 or later** ([AGPL-3.0-or-later](view/LICENSE)).

The map view executes in an isolated WebKit process inside Prisma UI and communicates with the C++ plugin strictly via JSON/IPC over the Prisma UI API, maintaining clean architectural and licensing boundaries.