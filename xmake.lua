local plugin_version = "0.9.7"
local plugin_int_version = "1"
local project_name = "MAP76"
local license = "GPL-3.0"
local author = "BerryDangerous"

set_version(plugin_version)
set_license(license)
set_languages("c++23")

if is_host("linux") then
    local msvc_wine_path = os.getenv("MSVC_WINE_PATH")

    local function latest(base_path)
        local best
        for _, d in ipairs(os.dirs(base_path .. "/*") or {}) do
            local name = d:match("([^/]+)$")
            if name and name:match("^%d+%.%d+%.%d+%.?%d*$") and (not best or name > best) then best = name end
        end
        return best and (base_path .. "/" .. best), base_path
    end

    local function check(base, base_path, subpath, name, is_file, fn)
        local path = base and (base .. subpath) or (base_path .. "/<ver>" .. subpath)
        if base and (is_file and os.isfile(path) or os.isdir(path)) then
            fn(path)
        elseif not _g_msvc_wine_checked then
            print("%s could not be found at '%s' and will not be configured.", name, path)
        end
    end

    if msvc_wine_path then
        local sdk, sdk_base = latest(msvc_wine_path .. "/kits/10/bin")
        local msvc, msvc_base = latest(msvc_wine_path .. "/VC/Tools/MSVC")
        local kit, kit_base = latest(msvc_wine_path .. "/Windows Kits/10/Include")

        check(sdk, sdk_base, "/x64/rc.exe", "Resource compiler (rc.exe)", true, function(p) set_config("mrc", "wine " .. p) end)
        check(msvc, msvc_base, "/include", "MSVC include directory", false, add_includedirs)
        check(kit, kit_base, "/um", "Windows SDK 'um' include path", false, add_includedirs)
        check(kit, kit_base, "/shared", "Windows SDK 'shared' include path", false, add_includedirs)
    else
        if not _g_msvc_wine_checked then
            print("Warning: MSVC_WINE_PATH is not set in the environment. Cross-compilation via wine will not be configured.")
        end
    end

    set_runenv("TMPDIR", "/tmp")
    set_runenv("TMP", "/tmp")
    set_runenv("TEMP", "/tmp")
    _g_msvc_wine_checked = true
end


add_requires("nlohmann_json")

includes("lib/commonlibf4")
set_project(project_name)

target(project_name)
    set_kind("shared")
    set_filename(project_name .. ".dll")

    add_deps("commonlibf4")
    add_packages("nlohmann_json")

    add_rules("commonlibf4.plugin", {
        name    = project_name,
        author  = author,
        version = plugin_version,
    })

    add_includedirs("src")
    add_files("src/**.cpp")

    add_defines("WIN32_LEAN_AND_MEAN", "NOMINMAX")
    add_defines("SPDLOG_USE_STD_FORMAT")
    add_defines("MAP76_VERSION_INT=" .. plugin_int_version)
    add_defines("MAP76_PLUGIN_NAME=\"" .. project_name .. "\"")

    if is_plat("windows") then
        local home = os.getenv("HOME") or os.getenv("USERPROFILE")
        if home then
            add_cxflags("/d1trimfile:" .. home .. "/", {force = true})
        end
        add_cxflags("/permissive-", "/wd4200", "/wd4201", "/wd4324")
        add_syslinks("Version", "Ole32", "OleAut32", "User32", "bcrypt", "crypt32")
        add_shflags("/PDBALTPATH:%_PDB%")
    end