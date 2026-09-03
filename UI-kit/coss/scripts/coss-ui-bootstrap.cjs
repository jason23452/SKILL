#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const cp = require("child_process")

const at = String.fromCharCode(64)
const bs = String.fromCharCode(92)
const slash = String.fromCharCode(47)
const colon = String.fromCharCode(58)

const REQUIRED_RUNTIME_DEPENDENCIES = [
  "@base-ui/react",
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "tailwind-merge",
]

const REQUIRED_DEV_DEPENDENCIES = [
  "tailwindcss",
]

const VITE_DEV_DEPENDENCIES = [
  "@tailwindcss/vite",
  "vite-tsconfig-paths",
]

const COSS_INSTALL_MANIFEST = "coss-ui.json"

const DEFAULT_UI_COMPONENTS = [
  "accordion",
  "alert",
  "alert-dialog",
  "autocomplete",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "calendar",
  "card",
  "checkbox",
  "checkbox-group",
  "collapsible",
  "combobox",
  "command",
  "context-menu",
  "dialog",
  "drawer",
  "empty",
  "field",
  "fieldset",
  "form",
  "frame",
  "group",
  "input",
  "otp-field",
  "input-group",
  "kbd",
  "label",
  "menu",
  "meter",
  "number-field",
  "pagination",
  "popover",
  "preview-card",
  "progress",
  "radio-group",
  "scroll-area",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "skeleton",
  "slider",
  "spinner",
  "switch",
  "table",
  "tabs",
  "textarea",
  "toast",
  "toggle",
  "toggle-group",
  "toolbar",
  "tooltip",
]

function logStatus(message) {
  console.warn(message)
  if (process.platform === "win32") return
  try {
    fs.appendFileSync("/proc/1/fd/2", `${message}\n`)
  } catch {}
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return fallback
  }
}

function stripJsonc(value) {
  const input = String(value || "")
  let output = ""
  let inString = false
  let escaped = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false
        output += char
      }
      continue
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false
        index += 1
      } else if (char === "\n") {
        output += char
      }
      continue
    }

    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === bs) escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      output += char
    } else if (char === "/" && next === "/") {
      inLineComment = true
      index += 1
    } else if (char === "/" && next === "*") {
      inBlockComment = true
      index += 1
    } else {
      output += char
    }
  }

  return output
}

function stripTrailingJsonCommas(value) {
  const input = String(value || "")
  let output = ""
  let inString = false
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === bs) escaped = true
      else if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === ",") {
      let nextIndex = index + 1
      while (/\s/u.test(input[nextIndex] || "")) nextIndex += 1
      if (input[nextIndex] === "}" || input[nextIndex] === "]") continue
    }

    output += char
  }

  return output
}

function readJsonc(file, fallback) {
  try {
    return JSON.parse(stripTrailingJsonCommas(stripJsonc(fs.readFileSync(file, "utf8"))))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function normalizePath(value) {
  let output = String(value || "").split(bs).join("/")
  while (output.endsWith("/")) output = output.slice(0, -1)
  return output
}

function projectPath(value) {
  let output = normalizePath(value)
  while (output.startsWith("./")) output = output.slice(2)
  return output === "." ? "" : output
}

function joinProjectPath(...parts) {
  return projectPath(path.join(...parts.filter(Boolean)))
}

function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory()
  } catch {
    return false
  }
}

function extendedConfigFile(file, value) {
  if (typeof value !== "string" || (!value.startsWith(".") && !path.isAbsolute(value))) return ""
  const target = path.isAbsolute(value) ? value : path.resolve(path.dirname(file), value)
  const candidates = target.endsWith(".json")
    ? [target]
    : [target, `${target}.json`, path.join(target, "tsconfig.json")]
  const match = candidates.find((candidate) => fs.existsSync(candidate))
  return match ? projectPath(path.relative(process.cwd(), match)) : ""
}

function configFilesFrom(initialFiles) {
  const queue = [...initialFiles]
  const files = []
  const seen = new Set()

  while (queue.length) {
    const file = queue.shift()
    const key = normalizePath(path.resolve(file)).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    files.push(file)

    const config = readJsonc(file, {})
    const extensions = Array.isArray(config.extends) ? config.extends : [config.extends]
    for (const value of extensions) {
      const extended = extendedConfigFile(file, value)
      if (extended) queue.push(extended)
    }
  }

  return files
}

function projectConfigFiles() {
  return configFilesFrom(["tsconfig.app.json", "tsconfig.json", "jsconfig.json"].filter((file) => fs.existsSync(file)))
}

function aliasMappingsFromFiles(files) {
  const mappings = []

  for (const file of files) {
    const config = readJsonc(file, {})
    const compilerOptions = config.compilerOptions || {}
    const configDirectory = projectPath(path.dirname(file))
    const baseUrl = joinProjectPath(configDirectory, compilerOptions.baseUrl || ".")

    for (const [pattern, targets] of Object.entries(compilerOptions.paths || {})) {
      const wildcard = pattern.endsWith("*")
      const aliasPrefix = wildcard ? pattern.slice(0, -1) : pattern
      if (!aliasPrefix) continue

      for (const target of Array.isArray(targets) ? targets : [targets]) {
        if (typeof target !== "string") continue
        const targetWildcard = target.endsWith("*")
        if (wildcard !== targetWildcard) continue
        const targetPrefix = joinProjectPath(baseUrl, targetWildcard ? target.slice(0, -1) : target)
        mappings.push({ aliasPrefix, targetPrefix, wildcard })
      }
    }
  }

  return mappings
}

function projectAliasMappings() {
  return aliasMappingsFromFiles(projectConfigFiles())
}

function mappingTargetExists(mapping, normalized) {
  const aliasBase = mapping.aliasPrefix.replace(/\/$/u, "")
  const remainder = normalized === aliasBase ? "" : normalized.slice(mapping.aliasPrefix.length)
  const target = joinProjectPath(mapping.targetPrefix, remainder)
  return Number(fs.existsSync(target || ".")) * 2 + Number(fs.existsSync(mapping.targetPrefix || "."))
}

function detectSourceRoot() {
  const rootAlias = projectAliasMappings()
    .filter((mapping) => mapping.wildcard && /^[@~#]\/$/u.test(mapping.aliasPrefix))
    .sort((left, right) => Number(fs.existsSync(right.targetPrefix || ".")) - Number(fs.existsSync(left.targetPrefix || ".")))[0]
  if (rootAlias) return rootAlias.targetPrefix

  return ["src", "app", "client/src"].find(isDirectory) || "src"
}

function aliasMappingFor(alias) {
  const mappings = projectAliasMappings()
  const raw = String(alias || "").split(bs).join("/")
  const normalized = raw === `${at}/` || mappings.some((candidate) => raw === candidate.aliasPrefix)
    ? raw
    : projectPath(raw)
  const mapping = mappings
    .filter((candidate) => candidate.wildcard
      ? normalized === candidate.aliasPrefix.replace(/\/$/u, "") || normalized.startsWith(candidate.aliasPrefix)
      : normalized === candidate.aliasPrefix)
    .sort((left, right) =>
      right.aliasPrefix.length - left.aliasPrefix.length ||
      mappingTargetExists(right, normalized) - mappingTargetExists(left, normalized))[0]

  return { mapping, normalized }
}

function aliasToPath(alias) {
  const { mapping, normalized } = aliasMappingFor(alias)

  if (mapping) {
    const aliasBase = mapping.aliasPrefix.replace(/\/$/u, "")
    const remainder = normalized === aliasBase ? "" : normalized.slice(mapping.aliasPrefix.length)
    return joinProjectPath(mapping.targetPrefix, remainder) || "."
  }
  return /^[@~#]/u.test(normalized) ? "" : normalized
}

function pathToAlias(dir) {
  const normalized = projectPath(dir)
  const mapping = projectAliasMappings()
    .filter((candidate) => candidate.wildcard
      ? candidate.targetPrefix === "" || normalized === candidate.targetPrefix || normalized.startsWith(`${candidate.targetPrefix}/`)
      : normalized === candidate.targetPrefix)
    .sort((left, right) => right.targetPrefix.length - left.targetPrefix.length)[0]

  if (mapping) {
    const remainder = normalized.slice(mapping.targetPrefix.length).replace(/^\/+/, "")
    return remainder ? `${mapping.aliasPrefix}${remainder}` : mapping.aliasPrefix.replace(/\/$/u, "")
  }

  const sourceRoot = detectSourceRoot()
  if (normalized === sourceRoot) return `${at}/`
  return normalized.startsWith(`${sourceRoot}/`) ? `${at}/${normalized.slice(sourceRoot.length + 1)}` : normalized
}

function withoutTs(file) {
  return file.endsWith(".ts") ? file.slice(0, -3) : file
}

function hasDependency(name) {
  const pkg = readJson("package.json", {})
  return Boolean((pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name])
}

function detectPackageManager() {
  if (fs.existsSync("pnpm-lock.yaml")) return "pnpm"
  if (fs.existsSync("bun.lock") || fs.existsSync("bun.lockb")) return "bun"
  if (fs.existsSync("yarn.lock")) return "yarn"
  if (fs.existsSync("package-lock.json")) return "npm"
  return "pnpm"
}

function packageManagerEnv(packageManager) {
  const env = { ...process.env, CI: "1" }
  if (packageManager !== "pnpm") return env

  env.PNPM_CONFIG_IGNORE_SCRIPTS = "true"
  try {
    const modules = fs.readFileSync(path.join("node_modules", ".modules.yaml"), "utf8")
    const match = modules.match(/["']?virtualStoreDirMaxLength["']?\s*:\s*(\d+)/)
    if (match) env.npm_config_virtual_store_dir_max_length = match[1]
  } catch {}
  return env
}

function packageInstallCommand(packageManager, names, dev) {
  if (packageManager === "npm") return ["npm", ["install", ...(dev ? ["--save-dev"] : []), ...names]]
  if (packageManager === "yarn") return ["yarn", ["add", ...(dev ? ["-D"] : []), ...names]]
  if (packageManager === "bun") return ["bun", ["add", ...(dev ? ["-d"] : []), ...names]]
  return ["pnpm", ["add", ...(dev ? ["-D"] : []), ...names]]
}

function shadcnCommand(packageManager, specs) {
  if (packageManager === "npm") return ["npx", ["--yes", "shadcn@latest", "add", ...specs, "--yes", "--overwrite"]]
  if (packageManager === "yarn") return ["yarn", ["dlx", "shadcn@latest", "add", ...specs, "--yes", "--overwrite"]]
  if (packageManager === "bun") return ["bunx", ["shadcn@latest", "add", ...specs, "--yes", "--overwrite"]]
  return ["pnpm", ["dlx", "shadcn@latest", "add", ...specs, "--yes", "--overwrite"]]
}

function installDependencies(names, dev) {
  const missing = names.filter((name) => !hasDependency(name))
  if (!missing.length) return

  const packageManager = detectPackageManager()
  const [command, args] = packageInstallCommand(packageManager, missing, dev)

  logStatus(`coss installing missing ${dev ? "dev " : ""}dependencies with ${packageManager}: ${missing.join(" ")}`)
  const result = cp.spawnSync(command, args, {
    stdio: "inherit",
    env: packageManagerEnv(packageManager),
    // Windows package manager launchers are .cmd files and require a shell.
    shell: process.platform === "win32",
  })

  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with code ${result.status || 1}`)
}

function ensureRuntimeDependencies() {
  installDependencies(REQUIRED_RUNTIME_DEPENDENCIES, false)
}

function ensureDevDependencies() {
  installDependencies(REQUIRED_DEV_DEPENDENCIES, true)
}

function viteConfigFile() {
  return [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mts",
    "vite.config.mjs",
    "vite.config.cts",
    "vite.config.cjs",
  ].find((name) => fs.existsSync(name))
}

function tailwindCssCandidates() {
  const sourceRoot = detectSourceRoot()
  return [...new Set([
    joinProjectPath(sourceRoot, "app", "globals.css"),
    joinProjectPath(sourceRoot, "app", "global.css"),
    joinProjectPath(sourceRoot, "styles", "globals.css"),
    joinProjectPath(sourceRoot, "styles", "global.css"),
    joinProjectPath(sourceRoot, "index.css"),
    joinProjectPath(sourceRoot, "globals.css"),
    joinProjectPath(sourceRoot, "global.css"),
    "app/globals.css",
    "app/global.css",
    "app/tailwind.css",
    "styles/globals.css",
    "app/assets/css/main.css",
  ].filter(Boolean))]
}

function ensureTailwindCssEntry() {
  const candidates = tailwindCssCandidates()
  const sourceRoot = detectSourceRoot()
  const appRoot = [joinProjectPath(sourceRoot, "app"), "app"].find(isDirectory)
  const cssFile = candidates.find((file) => fs.existsSync(file)) ||
    (appRoot ? joinProjectPath(appRoot, "globals.css") : joinProjectPath(sourceRoot || "src", "index.css"))
  fs.mkdirSync(path.dirname(cssFile), { recursive: true })

  const importLine = '@import "tailwindcss";'
  const existing = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf8") : ""
  if (existing.includes('@import "tailwindcss"') || existing.includes("@import 'tailwindcss'")) return cssFile

  fs.writeFileSync(cssFile, `${importLine}\n${existing ? `\n${existing}` : ""}`)
  return cssFile
}

function ensureCssImported(cssFile) {
  const sourceRoot = detectSourceRoot()
  const mainFiles = ["tsx", "jsx", "ts", "js"].map((extension) => joinProjectPath(sourceRoot, `main.${extension}`))
  const mainFile = mainFiles.find((file) => fs.existsSync(file))
  if (!mainFile) return

  const content = fs.readFileSync(mainFile, "utf8")
  if (/import\s+["'][^"']*(index|globals?|main|tailwind)\.css["'];?/u.test(content)) return

  const relative = normalizePath(path.relative(path.dirname(mainFile), cssFile))
  const importPath = relative.startsWith(".") ? relative : `./${relative}`
  fs.writeFileSync(mainFile, `import "${importPath}";\n${content}`)
}

function ensureViteTailwindPlugin() {
  const file = viteConfigFile()
  if (!file) return

  let content = fs.readFileSync(file, "utf8")
  const commonJs = file.endsWith(".cjs")
  if (commonJs) {
    if (!content.includes("cossBaseConfig")) {
      if (!/module\.exports\s*=/u.test(content)) {
        throw new Error(`coss could not configure Vite plugins in ${file}: missing module.exports`)
      }
      content = content.replace(/module\.exports\s*=/u, "const cossBaseConfig =")
      content += [
        "",
        "module.exports = async (...args) => {",
        "  const [{ default: tailwindcss }, { default: tsconfigPaths }] = await Promise.all([",
        '    import("@tailwindcss/vite"),',
        '    import("vite-tsconfig-paths"),',
        "  ]);",
        "  const resolved = typeof cossBaseConfig === \"function\"",
        "    ? await cossBaseConfig(...args)",
        "    : await cossBaseConfig;",
        "",
        "  return {",
        "    ...resolved,",
        "    plugins: [tailwindcss(), tsconfigPaths(), ...((resolved && resolved.plugins) || [])],",
        "  };",
        "};",
        "",
      ].join("\n")
    }
    fs.writeFileSync(file, content)
    return
  }

  if (!content.includes("@tailwindcss/vite")) {
    const importLine = 'import tailwindcss from "@tailwindcss/vite";\n'
    if (/import\s+\{?\s*defineConfig/u.test(content)) {
      content = content.replace(/(import\s+\{?\s*defineConfig[\s\S]*?from\s+["']vite["'];?\n)/u, `$1${importLine}`)
    } else {
      content = `${importLine}${content}`
    }
  }
  if (!content.includes("vite-tsconfig-paths")) {
    const importLine = 'import tsconfigPaths from "vite-tsconfig-paths";\n'
    content = `${importLine}${content}`
  }

  const missingPlugins = [
    !content.includes("tailwindcss()") ? "tailwindcss()" : "",
    !content.includes("tsconfigPaths()") ? "tsconfigPaths()" : "",
  ].filter(Boolean)
  if (missingPlugins.length && /plugins\s*:\s*\[/u.test(content)) {
    content = content.replace(/plugins\s*:\s*\[/u, `plugins: [${missingPlugins.join(", ")}, `)
  } else if (missingPlugins.length) {
    const configObject = /module\.exports\s*=\s*\{/u.test(content)
      ? /module\.exports\s*=\s*\{/u
      : (/export\s+default\s*\{/u.test(content) ? /export\s+default\s*\{/u : /defineConfig\s*\(\s*\{/u)
    content = content.replace(configObject, (match) => `${match}\n  plugins: [${missingPlugins.join(", ")}],`)
  }

  fs.writeFileSync(file, content)
}

function ensureTailwindSetup() {
  ensureDevDependencies()
  const cssFile = ensureTailwindCssEntry()
  ensureCssImported(cssFile)
  if (viteConfigFile()) {
    installDependencies(VITE_DEV_DEPENDENCIES, true)
    ensureViteTailwindPlugin()
  }
}

function ensureTsconfigAlias(file) {
  const config = readJsonc(file, null)
  if (!config) return
  const baseUrl = projectPath((config.compilerOptions || {}).baseUrl || ".")
  const paths = {
    ...((config.compilerOptions || {}).paths || {}),
  }
  const hasInheritedRootAlias = aliasMappingsFromFiles(configFilesFrom([file]))
    .some((mapping) => mapping.wildcard && /^[@~#]\/$/u.test(mapping.aliasPrefix))
  if (!paths["@/*"] && !hasInheritedRootAlias) {
    const relativeSourceRoot = projectPath(path.relative(baseUrl || ".", detectSourceRoot() || "."))
    paths["@/*"] = [relativeSourceRoot ? `./${relativeSourceRoot}/*` : "./*"]
  }

  config.compilerOptions = {
    ...(config.compilerOptions || {}),
    baseUrl: (config.compilerOptions || {}).baseUrl || ".",
    paths,
  }
  writeJson(file, config)
}

function ensureProjectAliases() {
  const files = ["tsconfig.json", "tsconfig.app.json", "jsconfig.json"].filter((file) => fs.existsSync(file))
  if (!files.length) {
    const sourceRoot = detectSourceRoot()
    writeJson("jsconfig.json", {
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": [sourceRoot ? `./${sourceRoot}/*` : "./*"] },
      },
    })
    return
  }

  for (const file of files) ensureTsconfigAlias(file)
}

function configuredAlias(aliases, name) {
  const value = aliases && aliases[name]
  if (typeof value !== "string" || !value.trim()) return ""
  const { mapping, normalized } = aliasMappingFor(value)
  return /^[@~#]/u.test(normalized) && !mapping ? "" : value
}

function configuredAliasPath(config, name) {
  const value = configuredAlias(config.aliases || {}, name)
  return value ? aliasToPath(value) : ""
}

function commonRootForUi(ui) {
  const parent = projectPath(path.dirname(ui))
  if (path.basename(parent) === "components") return projectPath(path.dirname(parent)) || detectSourceRoot()
  return parent || detectSourceRoot()
}

function componentSourceRoots() {
  const sourceRoot = detectSourceRoot()
  const roots = [sourceRoot]
  for (const candidate of ["src", "app"]) {
    if (isDirectory(candidate) && !roots.includes(candidate)) roots.push(candidate)
  }
  return roots
}

function detectAliasedUiDirectory() {
  for (const mapping of projectAliasMappings()) {
    const aliasName = mapping.aliasPrefix.replace(/\/$/u, "").split("/").pop().replace(/^[@~#]/u, "").toLowerCase()
    if (["ui", "primitives"].includes(aliasName)) return mapping.targetPrefix
    if (["component", "components", "design-system", "designsystem"].includes(aliasName)) {
      return joinProjectPath(mapping.targetPrefix, "ui")
    }
  }
  return ""
}

function pathHasAlias(dir) {
  const normalized = projectPath(dir)
  return projectAliasMappings().some((mapping) => mapping.wildcard
    ? mapping.targetPrefix === "" || normalized === mapping.targetPrefix || normalized.startsWith(`${mapping.targetPrefix}/`)
    : normalized === mapping.targetPrefix)
}

function detectExistingUiDirectory() {
  const uiDirectories = [
    "shared/components/ui",
    "common/components/ui",
    "core/components/ui",
    "lib/components/ui",
    "design-system/components/ui",
    "design-system/primitives",
    "design-system/ui",
    "app/components/ui",
    "components/ui",
    "shared/primitives",
    "common/primitives",
    "core/primitives",
    "lib/primitives",
    "components/primitives",
    "primitives",
    "shared/ui",
    "common/ui",
    "app/ui",
    "ui",
  ]
  const componentDirectories = [
    "shared/components",
    "common/components",
    "core/components",
    "lib/components",
    "design-system/components",
    "app/components",
    "components",
  ]
  const commonRoots = ["shared", "common", "core", "design-system", "app"]

  for (const sourceRoot of componentSourceRoots()) {
    for (const directory of uiDirectories) {
      const candidate = joinProjectPath(sourceRoot, directory)
      if (isDirectory(candidate)) return candidate
    }
  }

  for (const sourceRoot of componentSourceRoots()) {
    for (const directory of componentDirectories) {
      const candidate = joinProjectPath(sourceRoot, directory)
      if (isDirectory(candidate)) return joinProjectPath(candidate, "ui")
    }
    for (const directory of commonRoots) {
      const candidate = joinProjectPath(sourceRoot, directory)
      if (isDirectory(candidate)) return joinProjectPath(candidate, "components", "ui")
    }
  }

  return ""
}

function detectComponentLayout(config) {
  const configuredUi = configuredAliasPath(config, "ui")
  const configuredComponents = configuredAliasPath(config, "components")
  const ui = configuredUi ||
    (configuredComponents ? joinProjectPath(configuredComponents, "ui") : "") ||
    detectAliasedUiDirectory() ||
    detectExistingUiDirectory() ||
    joinProjectPath(detectSourceRoot(), "components", "ui")
  const commonRoot = commonRootForUi(ui)
  const sourceRoot = detectSourceRoot()
  const reusableRoot = pathHasAlias(commonRoot) ? commonRoot : (pathHasAlias(ui) ? ui : commonRoot)
  const localSharedRoot = reusableRoot === sourceRoot ? "" : reusableRoot
  const componentsRoot = projectPath(path.dirname(ui))

  return {
    ui,
    components: configuredComponents || (pathHasAlias(componentsRoot) ? componentsRoot : ui),
    utils: configuredAliasPath(config, "utils") ||
      (localSharedRoot ? joinProjectPath(localSharedRoot, "utils", "cn") : joinProjectPath(sourceRoot, "lib", "utils")),
    hooks: configuredAliasPath(config, "hooks") ||
      (localSharedRoot ? joinProjectPath(localSharedRoot, "hooks") : joinProjectPath(sourceRoot, "hooks")),
  }
}

function ensureComponentsConfig() {
  const config = readJson("components.json", {
    style: "new-york",
    rsc: false,
    tsx: true,
    tailwind: {
      css: tailwindCssCandidates().find((file) => fs.existsSync(file)) || joinProjectPath(detectSourceRoot() || "src", "index.css"),
      baseColor: "neutral",
      cssVariables: true,
    },
    iconLibrary: "lucide",
    aliases: {},
  })
  const layout = detectComponentLayout(config)
  const existingAliases = config.aliases || {}

  config.$schema = config.$schema || "https://ui.shadcn.com/schema.json"
  config.aliases = {
    ...existingAliases,
    components: configuredAlias(existingAliases, "components") || pathToAlias(layout.components),
    ui: configuredAlias(existingAliases, "ui") || pathToAlias(layout.ui),
    utils: configuredAlias(existingAliases, "utils") || pathToAlias(withoutTs(layout.utils)),
    lib: configuredAlias(existingAliases, "lib") || pathToAlias(path.dirname(layout.utils)),
    hooks: configuredAlias(existingAliases, "hooks") || pathToAlias(layout.hooks),
  }
  config.registries = {
    ...(config.registries || {}),
    [at + "coss"]: "https://coss.com/ui/r/{name}.json",
  }

  const ui = aliasToPath(config.aliases.ui)
  const utils = aliasToPath(config.aliases.utils)
  const hooks = aliasToPath(config.aliases.hooks)
  for (const dir of [ui, path.dirname(`${withoutTs(utils)}.ts`), hooks]) fs.mkdirSync(dir, { recursive: true })

  const utilsFile = `${withoutTs(utils)}.ts`
  if (!fs.existsSync(utilsFile)) {
    fs.writeFileSync(utilsFile, [
      "import { clsx, type ClassValue } from 'clsx';",
      "import { twMerge } from 'tailwind-merge';",
      "",
      "export function cn(...inputs: ClassValue[]) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
    ].join("\n"))
  }

  writeJson("components.json", config)
}

function moveDirContents(source, target) {
  if (!fs.existsSync(source)) return false
  fs.mkdirSync(target, { recursive: true })
  let moved = false
  for (const name of fs.readdirSync(source)) {
    const from = path.join(source, name)
    const to = path.join(target, name)
    if (fs.existsSync(to)) {
      logStatus(`coss repair kept existing ${normalizePath(to)}; leaving ${normalizePath(from)} in place`)
      continue
    }
    fs.renameSync(from, to)
    moved = true
  }
  return moved
}

function removeEmptyParents(dir, stopAt) {
  let current = normalizePath(dir)
  const stop = normalizePath(stopAt)
  while (current && current !== stop && fs.existsSync(current)) {
    try {
      if (fs.readdirSync(current).length) return
      fs.rmdirSync(current)
    } catch {
      return
    }
    current = normalizePath(path.dirname(current))
  }
  if (current === stop && fs.existsSync(current)) {
    try {
      if (!fs.readdirSync(current).length) fs.rmdirSync(current)
    } catch {}
  }
}

function repairMisplacedAliasArtifacts() {
  const config = readJson("components.json", { aliases: {} })
  const aliases = config.aliases || {}
  const repairs = [
    [aliases.ui || `${at}/components/ui`, aliasToPath(aliases.ui || "src/components/ui")],
    [aliases.utils || `${at}/lib/utils`, aliasToPath(aliases.utils || "src/lib/utils")],
    [aliases.lib || `${at}/lib`, aliasToPath(aliases.lib || "src/lib")],
    [aliases.hooks || `${at}/hooks`, aliasToPath(aliases.hooks || "src/hooks")],
  ]
  for (const [alias, target] of repairs) {
    const source = normalizePath(alias)
    if (!source || source === target) continue
    if (moveDirContents(source, target)) {
      logStatus(`coss repair moved ${source} -> ${target}`)
      removeEmptyParents(source, source.split("/")[0])
    }
  }
}

function cleanComponent(value) {
  let name = String(value || "").trim().toLowerCase()
  const coss = "coss"
  const cut = (prefix) => {
    if (!name.startsWith(prefix)) return false
    name = name.slice(prefix.length)
    return true
  }
  cut(at + coss + slash) || cut(coss + slash) || cut(at + coss + colon) || cut(coss + colon)
  if (name.startsWith(at)) name = name.slice(1)
  return name.split("").filter((ch) => "abcdefghijklmnopqrstuvwxyz0123456789-".includes(ch)).join("")
}

function requestedComponents() {
  return String(process.env.COSS_COMPONENTS || "")
    .replaceAll(",", " ")
    .split(" ")
    .map(cleanComponent)
    .filter(Boolean)
}

function verificationComponents() {
  if (Object.prototype.hasOwnProperty.call(process.env, "COSS_COMPONENTS")) return requestedComponents()

  const manifest = readJson(COSS_INSTALL_MANIFEST, {})
  const components = Array.isArray(manifest.components) ? manifest.components : []
  return components.map(cleanComponent).filter(Boolean)
}

function installSpecs(requested) {
  const mode = String(process.env.COSS_BOOTSTRAP_MODE || "fast").toLowerCase()
  if (mode === "full-style" || mode === "style" || mode === "full") return [at + "coss/style"]
  if (requested.length) return [...new Set(requested.map((name) => at + "coss/" + name).concat(at + "coss/colors-neutral"))]
  return [at + "coss/ui", at + "coss/colors-neutral"]
}

function expectedUiComponents(requested) {
  const names = requested.filter((name) => name !== "colors-neutral" && name !== "style")
  if (!names.length || names.includes("ui")) return DEFAULT_UI_COMPONENTS
  return names
}

function sourceFile(file) {
  return [file, `${file}.ts`, `${file}.tsx`, `${file}.js`, `${file}.jsx`]
    .concat(["ts", "tsx", "js", "jsx"].map((extension) => path.join(file, `index.${extension}`)))
    .find((candidate) => fs.existsSync(candidate))
}

function componentFile(ui, name) {
  return sourceFile(path.join(ui, name))
}

function componentFileExists(ui, name) {
  return Boolean(componentFile(ui, name))
}

function missingProjectImports(ui, components) {
  const missing = []
  const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/gu

  for (const component of components) {
    const file = componentFile(ui, component)
    if (!file) continue

    const source = fs.readFileSync(file, "utf8")
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1]
      const aliasMapping = aliasMappingFor(specifier).mapping
      const localFile = specifier.startsWith(".")
        ? projectPath(path.relative(process.cwd(), path.resolve(path.dirname(file), specifier)))
        : (aliasMapping ? aliasToPath(specifier) : "")
      if (localFile && !sourceFile(localFile)) missing.push(`${component}: ${specifier}`)
    }
  }

  return [...new Set(missing)]
}

function cossArtifactStatus(requested) {
  const config = readJson("components.json", { aliases: {} })
  const ui = aliasToPath((config.aliases || {}).ui || "src/components/ui")
  const utils = aliasToPath((config.aliases || {}).utils || "src/lib/utils")
  const expected = expectedUiComponents(requested)
  const registry = (config.registries || {})[at + "coss"]
  const registryUrl = typeof registry === "string" ? registry : registry && registry.url

  return {
    expected,
    hasOfficialRegistry: registryUrl === "https://coss.com/ui/r/{name}.json",
    hasUtils: fs.existsSync(utils) || fs.existsSync(`${utils}.ts`),
    missingComponents: fs.existsSync(ui)
      ? expected.filter((name) => !componentFileExists(ui, name))
      : expected,
    missingDependencies: REQUIRED_RUNTIME_DEPENDENCIES.filter((name) => !hasDependency(name)),
    missingProjectImports: fs.existsSync(ui) ? missingProjectImports(ui, expected) : [],
    ui,
    utils,
  }
}

function cossArtifactFilesReady(requested) {
  const status = cossArtifactStatus(requested)
  return status.hasOfficialRegistry &&
    status.hasUtils &&
    !status.missingComponents.length &&
    !status.missingProjectImports.length
}

function cossArtifactsReady(requested) {
  const status = cossArtifactStatus(requested)
  return status.hasOfficialRegistry &&
    status.hasUtils &&
    !status.missingComponents.length &&
    !status.missingProjectImports.length &&
    !status.missingDependencies.length
}

function cossArtifactsError(requested) {
  const status = cossArtifactStatus(requested)
  const problems = []

  if (!status.hasOfficialRegistry) {
    problems.push('components.json registries["@coss"] must be https://coss.com/ui/r/{name}.json')
  }
  if (!status.hasUtils) problems.push(`missing coss utility module at ${status.utils}.ts`)
  if (status.missingComponents.length) {
    problems.push(`missing official coss component files in ${status.ui}: ${status.missingComponents.join(", ")}`)
  }
  if (status.missingProjectImports.length) {
    problems.push(`broken generated local imports: ${status.missingProjectImports.join(", ")}`)
  }
  if (status.missingDependencies.length) {
    problems.push(`missing runtime dependencies: ${status.missingDependencies.join(", ")}`)
  }

  return `coss UI verification failed: ${problems.join("; ")}`
}

function assertCossArtifactsReady(requested) {
  if (!cossArtifactsReady(requested)) throw new Error(cossArtifactsError(requested))
}

function writeCossInstallState(requested) {
  writeJson(COSS_INSTALL_MANIFEST, {
    components: requested,
    mode: String(process.env.COSS_BOOTSTRAP_MODE || "fast").toLowerCase(),
  })
}

function verifyCossUi(requested) {
  assertCossArtifactsReady(requested)
  const status = cossArtifactStatus(requested)
  logStatus(`coss official components verified in ${status.ui}: ${status.expected.join(", ")}`)
}

function writeUiIndex() {
  const config = readJson("components.json", { aliases: {} })
  const ui = aliasToPath((config.aliases || {}).ui || "src/components/ui")
  if (!fs.existsSync(ui)) return

  const output = fs.readdirSync(ui)
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && name !== "index.ts")
    .sort()
    .map((name) => {
      const base = name.endsWith(".tsx") ? name.slice(0, -4) : name.slice(0, -3)
      return `export * from "./${base}";`
    })
    .join("\n")

  fs.writeFileSync(path.join(ui, "index.ts"), `${output}\n`)
}

function installCossUi() {
  const requested = requestedComponents()
  ensureRuntimeDependencies()
  if (cossArtifactFilesReady(requested)) {
    assertCossArtifactsReady(requested)
    logStatus("coss ui artifacts and runtime dependencies already present; skipping shadcn add")
    return Promise.resolve()
  }

  const packageManager = detectPackageManager()
  const env = packageManagerEnv(packageManager)
  const specs = installSpecs(requested)
  const [command, args] = shadcnCommand(packageManager, specs)

  return new Promise((resolve, reject) => {
    logStatus(`coss shadcn install starting with ${packageManager}: ${specs.join(" ")}`)
    const child = cp.spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
      // Windows package manager launchers are .cmd files and require a shell.
      shell: process.platform === "win32",
    })

    let done = false

    const finish = (error) => {
      if (done) return
      done = true
      clearInterval(heartbeat)
      if (error) reject(error)
      else resolve()
    }

    const pipe = (stream, output) => stream && stream.on("data", (chunk) => output.write(chunk))
    pipe(child.stdout, process.stdout)
    pipe(child.stderr, process.stderr)

    const heartbeat = setInterval(() => {
      logStatus(`coss shadcn install still running: ${specs.join(" ")}`)
    }, Number(process.env.COSS_SHADCN_HEARTBEAT_MS || 10000))
    if (heartbeat.unref) heartbeat.unref()

    child.on("close", (code, signal) => {
      repairMisplacedAliasArtifacts()
      if (code !== 0) {
        finish(new Error(`coss shadcn exited with code ${code ?? 1}${signal ? ` (${signal})` : ""}`))
        return
      }

      try {
        ensureRuntimeDependencies()
        assertCossArtifactsReady(requested)
      } catch (error) {
        finish(error)
        return
      }
      finish()
    })
    child.on("error", finish)
  })
}

async function main() {
  if (process.argv.includes("--verify")) {
    verifyCossUi(verificationComponents())
    return
  }

  const requested = requestedComponents()
  ensureProjectAliases()
  ensureTailwindSetup()
  ensureComponentsConfig()
  repairMisplacedAliasArtifacts()
  await installCossUi()
  repairMisplacedAliasArtifacts()
  verifyCossUi(requested)
  writeUiIndex()
  writeCossInstallState(requested)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : error)
    process.exit(1)
  })
}

module.exports = {
  aliasToPath,
  detectComponentLayout,
  ensureComponentsConfig,
  ensureProjectAliases,
  ensureViteTailwindPlugin,
  missingProjectImports,
  viteConfigFile,
}
