#!/usr/bin/env node

const fs = require("fs")
const https = require("https")
const path = require("path")
const cp = require("child_process")
const crypto = require("crypto")
const Module = require("module")
const { pathToFileURL } = require("url")

const at = String.fromCharCode(64)
const bs = String.fromCharCode(92)
const slash = String.fromCharCode(47)
const colon = String.fromCharCode(58)

const COSS_INSTALL_MANIFEST = "coss-ui.json"

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
  assertSafeProjectWritePath(file, file)
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

function normalizePath(value) {
  let output = String(value || "").split(bs).join("/")
  while (output.endsWith("/")) output = output.slice(0, -1)
  return output
}

function projectPathKey(value) {
  const normalized = normalizePath(value)
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
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

function projectRoot() {
  return path.resolve(process.cwd())
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function nearestExistingParent(target) {
  let current = target
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return ""
    current = parent
  }
  return current
}

function isSafeProjectPath(value) {
  if (typeof value !== "string") return false
  const root = projectRoot()
  const target = path.resolve(root, value || ".")
  if (!isWithin(root, target)) return false

  try {
    const realRoot = fs.realpathSync(root)
    const existingParent = nearestExistingParent(target)
    return Boolean(existingParent) && isWithin(realRoot, fs.realpathSync(existingParent))
  } catch {
    return false
  }
}

function projectPathHasSymlink(value) {
  const root = projectRoot()
  const target = path.resolve(root, value || ".")
  if (!isWithin(root, target)) return true
  const relative = path.relative(root, target)
  let current = root

  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    if (!fs.existsSync(current)) break
    try {
      if (fs.lstatSync(current).isSymbolicLink()) return true
    } catch {
      return true
    }
  }

  return false
}

function isSafeProjectFile(value) {
  if (!isSafeProjectPath(value) || projectPathHasSymlink(value)) return false
  const target = path.resolve(projectRoot(), value)

  try {
    return fs.lstatSync(target).isFile() && isWithin(fs.realpathSync(projectRoot()), fs.realpathSync(target))
  } catch {
    return false
  }
}

function isRouteLocalProjectPath(segments) {
  const projectType = detectUiProjectType()
  const routeRoots = projectType === "next" ? ["app", "pages"] : projectType === "remix" ? ["routes"] : []
  const sharedRootSegments = [
    "assets",
    "common",
    "components",
    "core",
    "design-system",
    "designsystem",
    "hooks",
    "lib",
    "primitives",
    "public",
    "shared",
    "styles",
    "ui",
    "utils",
  ]

  return routeRoots.some((routeRoot) => {
    const index = segments.indexOf(routeRoot)
    const firstChild = index === -1 ? "" : segments[index + 1]
    return Boolean(firstChild && !sharedRootSegments.includes(firstChild))
  })
}

function isReusableProjectPath(value) {
  if (!isSafeProjectPath(value) || projectPathHasSymlink(value)) return false
  const root = projectRoot()
  const target = path.resolve(root, value || ".")
  const candidates = [target]

  try {
    const existingParent = nearestExistingParent(target)
    const realParent = fs.realpathSync(existingParent)
    if (!candidates.includes(realParent)) candidates.push(realParent)
  } catch {
    return false
  }

  return candidates.every((candidate) => {
    const relative = normalizePath(path.relative(root, candidate)).toLowerCase()
    const segments = relative.split("/").filter(Boolean)
    return !isRouteLocalProjectPath(segments) && !segments.some((segment) =>
      ["feature", "features", "route", "routes", "page", "pages", "view", "views"].includes(segment) ||
      (segment.startsWith("(") && segment.endsWith(")")),
    )
  })
}

function assertSafeProjectPath(value, label) {
  if (!isSafeProjectPath(value)) {
    throw new Error(`coss bootstrap refuses to write ${label} outside the current project: ${value || "(empty)"}`)
  }
}

function assertSafeProjectWritePath(value, label) {
  assertSafeProjectPath(value, label)
  if (projectPathHasSymlink(value)) {
    throw new Error(`coss bootstrap refuses to write ${label} through a symlink: ${value}`)
  }
  const target = path.resolve(projectRoot(), value)
  try {
    if (fs.lstatSync(target).isSymbolicLink()) {
      throw new Error(`coss bootstrap refuses to write ${label} through a symlink: ${value}`)
    }
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error
  }
}

function assertSafeProjectReadPath(value, label) {
  assertSafeProjectPath(value, label)
  if (fs.existsSync(value) && !isSafeProjectFile(value)) {
    throw new Error(`coss bootstrap refuses to read ${label} through a symlink: ${value}`)
  }
}

function ensureSafeProjectDirectory(value, label) {
  assertSafeProjectWritePath(value, label)
  fs.mkdirSync(value, { recursive: true })
}

function assertBootstrapWritePaths() {
  for (const file of ["tsconfig.json", "tsconfig.app.json", "jsconfig.json", "components.json", COSS_INSTALL_MANIFEST]) {
    assertSafeProjectWritePath(file, file)
  }
}

function assertBootstrapReadPaths() {
  for (const file of ["tsconfig.json", "tsconfig.app.json", "jsconfig.json", "components.json", COSS_INSTALL_MANIFEST]) {
    assertSafeProjectReadPath(file, file)
  }
}

function extendedConfigFile(file, value) {
  if (typeof value !== "string" || !value) return ""
  const candidates = []

  if (value.startsWith(".") || path.isAbsolute(value)) {
    const target = path.isAbsolute(value) ? value : path.resolve(path.dirname(file), value)
    candidates.push(target, `${target}.json`, path.join(target, "tsconfig.json"))
  } else {
    const requireFromConfig = Module.createRequire(path.resolve(file))
    for (const specifier of [value, `${value}.json`, `${value}/tsconfig.json`]) {
      try {
        candidates.push(requireFromConfig.resolve(specifier))
      } catch {}
    }

    try {
      const packageFile = requireFromConfig.resolve(`${value}/package.json`)
      const packageConfig = readJson(packageFile, {})
      if (typeof packageConfig.tsconfig === "string") {
        candidates.push(path.resolve(path.dirname(packageFile), packageConfig.tsconfig))
      }
    } catch {}
  }

  const match = candidates.find((candidate) => candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  return match ? path.resolve(match) : ""
}

function effectiveTsConfig(file, seen = new Set()) {
  const configFile = path.resolve(file)
  const key = normalizePath(configFile).toLowerCase()
  if (seen.has(key)) return { baseUrl: path.dirname(configFile), paths: undefined }

  const nextSeen = new Set(seen)
  nextSeen.add(key)
  const config = readJsonc(configFile, {})
  const compilerOptions = config.compilerOptions && typeof config.compilerOptions === "object"
    ? config.compilerOptions
    : {}
  const extensions = Array.isArray(config.extends) ? config.extends : [config.extends]
  let inherited = { baseUrl: path.dirname(configFile), paths: undefined }

  for (const value of extensions) {
    const parent = extendedConfigFile(configFile, value)
    if (parent) inherited = effectiveTsConfig(parent, nextSeen)
  }

  const baseUrl = Object.prototype.hasOwnProperty.call(compilerOptions, "baseUrl") && typeof compilerOptions.baseUrl === "string"
    ? path.resolve(path.dirname(configFile), compilerOptions.baseUrl)
    : inherited.baseUrl
  const paths = Object.prototype.hasOwnProperty.call(compilerOptions, "paths") && compilerOptions.paths && typeof compilerOptions.paths === "object"
    ? compilerOptions.paths
    : inherited.paths

  return { baseUrl, paths }
}

function projectConfigFiles() {
  return ["tsconfig.app.json", "tsconfig.json", "jsconfig.json"]
    .filter((file) => fs.existsSync(file))
    .map((file) => path.resolve(file))
}

function aliasMappingsFromFiles(files) {
  const mappings = []

  for (const file of files) {
    const { baseUrl, paths } = effectiveTsConfig(file)
    for (const [pattern, targets] of Object.entries(paths || {})) {
      const wildcard = pattern.endsWith("*")
      const aliasPrefix = wildcard ? pattern.slice(0, -1) : pattern
      if (!aliasPrefix) continue

      for (const target of Array.isArray(targets) ? targets : [targets]) {
        if (typeof target !== "string") continue
        const targetWildcard = target.includes("*")
        if (wildcard !== targetWildcard) continue
        const targetPrefix = projectPath(path.relative(
          projectRoot(),
          path.resolve(baseUrl, targetWildcard ? target.slice(0, target.indexOf("*")) : target),
        ))
        mappings.push({ aliasPrefix, targetPrefix, wildcard, source: "tsconfig" })
      }
    }
  }

  return mappings
}

function packageImportMappings() {
  const pkg = readJson("package.json", {})
  const mappings = []

  for (const [pattern, rawTarget] of Object.entries(pkg.imports || {})) {
    const target = typeof rawTarget === "string" ? rawTarget : rawTarget && rawTarget.default
    if (typeof target !== "string" || !target.startsWith(".")) continue

    const wildcard = pattern.endsWith("*")
    const targetWildcard = target.includes("*")
    if (wildcard !== targetWildcard) continue

    const targetPrefix = projectPath(targetWildcard ? target.slice(0, target.indexOf("*")) : target)
    if (!isSafeProjectPath(targetPrefix)) continue
    mappings.push({ aliasPrefix: wildcard ? pattern.slice(0, -1) : pattern, targetPrefix, wildcard, source: "package-import" })
  }

  return mappings
}

function projectAliasMappings() {
  return aliasMappingsFromFiles(projectConfigFiles()).concat(packageImportMappings())
}

function mappingTargetExists(mapping, normalized) {
  const aliasBase = mapping.aliasPrefix.replace(/\/$/u, "")
  const remainder = normalized === aliasBase ? "" : normalized.slice(mapping.aliasPrefix.length)
  const target = joinProjectPath(mapping.targetPrefix, remainder)
  return Number(fs.existsSync(target || ".")) * 2 + Number(fs.existsSync(mapping.targetPrefix || "."))
}

function detectSourceRoot() {
  const rootAlias = projectAliasMappings()
    .filter((mapping) => mapping.wildcard && /^[@~#]\/$/u.test(mapping.aliasPrefix) && isSafeProjectPath(mapping.targetPrefix))
    .sort((left, right) => Number(fs.existsSync(right.targetPrefix || ".")) - Number(fs.existsSync(left.targetPrefix || ".")))[0]
  if (rootAlias) return rootAlias.targetPrefix

  return ["src", "app", "client/src"].find((candidate) => isSafeProjectPath(candidate) && isDirectory(candidate)) || "src"
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
    const resolved = joinProjectPath(mapping.targetPrefix, remainder) || "."
    return isSafeProjectPath(resolved) ? resolved : ""
  }
  return /^[@~#]/u.test(normalized) || !isSafeProjectPath(normalized) ? "" : normalized
}

function pathToAlias(dir) {
  if (!isSafeProjectPath(dir)) return ""
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

function isRuntimeAlias(value) {
  return typeof value === "string" && /^[@~#]/u.test(value)
}

function hasRuntimeAliasForPath(dir) {
  return isRuntimeAlias(pathToAlias(dir))
}

function withoutTs(file) {
  return file.replace(/\.(?:ts|tsx|js|jsx)$/u, "")
}

function projectPackage() {
  return readJson("package.json", null)
}

function packageHasDependency(pkg, name) {
  return Boolean(pkg && ((pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name]))
}

function detectUiProjectType() {
  const pkg = projectPackage()
  if (!pkg || typeof pkg !== "object") return ""

  if (packageHasDependency(pkg, "next")) return "next"
  if (packageHasDependency(pkg, "@remix-run/react") || packageHasDependency(pkg, "@remix-run/dev")) return "remix"
  if (packageHasDependency(pkg, "react")) {
    return viteConfigFile() || packageHasDependency(pkg, "vite") ? "react-vite" : "react"
  }

  return ""
}

function assertSupportedUiProject() {
  const projectType = detectUiProjectType()
  if (projectType && projectType !== "react") return projectType
  if (projectType === "react") {
    throw new Error("coss bootstrap requires a verified runtime alias resolver. Use React Vite, Next.js, or Remix with a Vite alias configuration.")
  }

  const pkg = projectPackage()
  const unsupported = ["vue", "nuxt", "svelte", "@angular/core"].find((name) => packageHasDependency(pkg, name))
  const suffix = unsupported ? ` Detected ${unsupported}.` : ""
  throw new Error(`coss bootstrap requires a React UI project with package.json.${suffix}`)
}

function hasDependency(name) {
  return packageHasDependency(projectPackage(), name)
}

function detectPackageManager() {
  const declared = String((projectPackage() || {}).packageManager || "").split("@")[0]
  if (["pnpm", "npm", "yarn", "bun"].includes(declared)) return declared
  if (fs.existsSync("pnpm-lock.yaml")) return "pnpm"
  if (fs.existsSync("bun.lock") || fs.existsSync("bun.lockb")) return "bun"
  if (fs.existsSync("yarn.lock")) return "yarn"
  if (fs.existsSync("package-lock.json")) return "npm"
  return "npm"
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

function isYarnClassic() {
  const declared = String((projectPackage() || {}).packageManager || "")
  const version = declared.match(/^yarn@(?:[~^])?(\d+)/u)
  if (version) return Number(version[1]) < 2
  return !fs.existsSync(".yarnrc.yml")
}

function shadcnCommand(packageManager, specs) {
  if (packageManager === "npm") return ["npx", ["--yes", "shadcn@latest", "add", ...specs, "--yes"]]
  if (packageManager === "yarn") {
    return isYarnClassic()
      ? ["npx", ["--yes", "shadcn@latest", "add", ...specs, "--yes"]]
      : ["yarn", ["dlx", "shadcn@latest", "add", ...specs, "--yes"]]
  }
  if (packageManager === "bun") return ["bunx", ["--bun", "shadcn@latest", "add", ...specs, "--yes"]]
  return ["pnpm", ["dlx", "shadcn@latest", "add", ...specs, "--yes"]]
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

function viteAliasEntries(config) {
  const aliases = config && config.resolve && config.resolve.alias
  if (Array.isArray(aliases)) return aliases
  if (!aliases || typeof aliases !== "object") return []
  return Object.entries(aliases).map(([find, replacement]) => ({ find, replacement }))
}

function normalizedAbsolutePath(value) {
  const resolved = path.resolve(projectRoot(), value)
  return process.platform === "win32" ? resolved.toLowerCase() : resolved
}

function viteAliasMapsPath(entry, alias, target) {
  if (!entry || typeof entry.replacement !== "string") return false
  let resolved = ""
  if (typeof entry.find === "string") {
    const find = entry.find.replace(/\/$/u, "")
    if (!find || (alias !== find && !alias.startsWith(`${find}/`))) return false
    const suffix = alias.slice(find.length).replace(/^\/+/, "")
    resolved = path.resolve(entry.replacement, suffix)
  } else if (entry.find instanceof RegExp) {
    entry.find.lastIndex = 0
    if (!entry.find.test(alias)) return false
    entry.find.lastIndex = 0
    resolved = path.resolve(alias.replace(entry.find, entry.replacement))
  } else {
    return false
  }
  const expected = path.resolve(projectRoot(), target)
  const resolvedFiles = [resolved, sourceFile(resolved)].filter(Boolean).map(normalizedAbsolutePath)
  const expectedFiles = [expected, sourceFile(expected)].filter(Boolean).map(normalizedAbsolutePath)
  return resolvedFiles.some((file) => expectedFiles.includes(file))
}

function viteUsesTsconfigPaths(config) {
  const viteVersion = String(installedPackageVersion("vite"))
  const major = viteVersion.match(/(?:^|[~^>=v\s])(\d+)/u)
  if (major && Number(major[1]) >= 8 && config && config.resolve && config.resolve.tsconfigPaths) return true
  return Array.isArray(config && config.plugins) && config.plugins.some((plugin) =>
    plugin && typeof plugin.name === "string" && plugin.name.includes("vite-tsconfig-paths"),
  )
}

function viteAliasesHaveRuntimeResolver(config, aliases) {
  const entries = viteAliasEntries(config)
  const usesTsconfigPaths = viteUsesTsconfigPaths(config)

  return Object.values(aliases || {})
    .filter((alias) => typeof alias === "string" && /^[@~#]/u.test(alias))
    .every((alias) => {
      const { mapping } = aliasMappingFor(alias)
      const target = aliasToPath(alias)
      return Boolean(target) && (
        entries.some((entry) => viteAliasMapsPath(entry, alias, target)) ||
        (usesTsconfigPaths && mapping && mapping.source === "tsconfig")
      )
    })
}

async function resolveViteConfig(command) {
  const projectRequire = Module.createRequire(path.join(projectRoot(), "package.json"))
  let vite

  try {
    const viteEntry = projectRequire.resolve("vite")
    vite = await import(pathToFileURL(viteEntry).href)
  } catch {
    throw new Error("coss bootstrap could not load the project's installed Vite resolver")
  }

  if (typeof vite.resolveConfig !== "function") {
    throw new Error("coss bootstrap could not load Vite's configuration resolver")
  }

  try {
    return await vite.resolveConfig({
      root: projectRoot(),
      configFile: viteConfigFile() ? path.resolve(viteConfigFile()) : undefined,
      logLevel: "error",
    }, command)
  } catch (error) {
    const message = error && error.message ? `: ${error.message}` : ""
    throw new Error(`coss bootstrap could not resolve the Vite ${command} configuration${message}`)
  }
}

async function assertViteAliasSupport() {
  if (detectUiProjectType() !== "react-vite" && !viteConfigFile()) return

  const config = readJson("components.json", {})
  for (const command of ["serve", "build"]) {
    const viteConfig = await resolveViteConfig(command)
    if (!viteAliasesHaveRuntimeResolver(viteConfig, config.aliases || {})) {
      throw new Error(
        `coss bootstrap requires Vite to resolve the configured component aliases in ${command} mode. ` +
        "Configure matching resolve.alias entries, resolve.tsconfigPaths: true, or vite-tsconfig-paths before rerunning.",
      )
    }
  }
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

function installedPackageVersion(name) {
  const packageFile = path.join("node_modules", ...name.split("/"), "package.json")
  const installed = readJson(packageFile, null)
  if (installed && typeof installed.version === "string") return installed.version
  const pkg = projectPackage() || {}
  return (pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name] || ""
}

function assertTailwindSetup() {
  if (!hasDependency("tailwindcss")) {
    throw new Error("coss bootstrap requires Tailwind CSS v4 before installing @coss/ui")
  }

  const version = String(installedPackageVersion("tailwindcss"))
  const major = version.match(/(?:^|[~^>=v\s])(\d+)/u)
  if (major && Number(major[1]) < 4) {
    throw new Error(`coss bootstrap requires Tailwind CSS v4; found ${version}`)
  }

  const configuredCss = configuredTailwindCssFile()
  const cssFile = configuredCss || tailwindCssCandidates().find((file) => isSafeProjectPath(file) && fs.existsSync(file))
  if (!cssFile) {
    throw new Error("coss bootstrap could not find an existing global CSS entry for Tailwind CSS v4")
  }

  assertSafeProjectReadPath(cssFile, "the Tailwind CSS entry")
  assertSafeProjectWritePath(cssFile, "the Tailwind CSS entry")
  if (!isSafeProjectFile(cssFile)) {
    throw new Error(`coss bootstrap could not find an existing global CSS entry for Tailwind CSS v4: ${cssFile}`)
  }

  const css = fs.readFileSync(cssFile, "utf8")
  if (!css.includes('@import "tailwindcss"') && !css.includes("@import 'tailwindcss'")) {
    throw new Error(`coss bootstrap requires @import \"tailwindcss\" in ${cssFile}`)
  }
  return cssFile
}

function tsBaseUrlValue(file, baseUrl) {
  const relative = normalizePath(path.relative(path.dirname(path.resolve(file)), baseUrl))
  if (!relative || relative === ".") return "."
  return relative.startsWith(".") ? relative : `./${relative}`
}

function rebaseTsPaths(paths, fromBaseUrl, toBaseUrl) {
  const rebased = {}
  for (const [pattern, targets] of Object.entries(paths || {})) {
    const values = []
    for (const target of Array.isArray(targets) ? targets : [targets]) {
      if (typeof target !== "string") continue
      const wildcard = target.indexOf("*")
      const prefix = wildcard === -1 ? target : target.slice(0, wildcard)
      const suffix = wildcard === -1 ? "" : target.slice(wildcard)
      const absolutePrefix = path.resolve(fromBaseUrl, prefix || ".")
      let relativePrefix = normalizePath(path.relative(toBaseUrl, absolutePrefix))
      if (!relativePrefix || relativePrefix === ".") relativePrefix = "."
      else if (!relativePrefix.startsWith(".")) relativePrefix = `./${relativePrefix}`
      if (wildcard !== -1 && (prefix.endsWith("/") || prefix.endsWith(bs))) relativePrefix += "/"
      values.push(`${relativePrefix}${suffix}`)
    }
    if (values.length) rebased[pattern] = values
  }
  return rebased
}

function ensureTsconfigAlias(file) {
  const config = readJsonc(file, null)
  if (!config) return
  const compilerOptions = config.compilerOptions || {}
  const effective = effectiveTsConfig(file)
  const hasOwnPaths = Object.prototype.hasOwnProperty.call(compilerOptions, "paths")
  const baseUrl = effective.baseUrl
  const paths = hasOwnPaths
    ? { ...(compilerOptions.paths || {}) }
    : rebaseTsPaths(effective.paths, effective.baseUrl, baseUrl)
  const hasInheritedRootAlias = aliasMappingsFromFiles([file])
    .some((mapping) => mapping.wildcard && /^[@~#]\/$/u.test(mapping.aliasPrefix))
  const hasOwnRootAlias = Object.keys(paths).some((pattern) => /^[@~#]\/\*$/u.test(pattern))

  // Adding a local paths object overrides aliases supplied by extends. Keep the
  // inherited configuration untouched when it already provides a root alias.
  if (hasInheritedRootAlias && !hasOwnRootAlias) return

  let changed = false
  for (const [pattern, targets] of Object.entries({ ...paths })) {
    if (!pattern.endsWith("/*")) continue
    const alias = pattern.slice(0, -2)
    if (!alias || alias.length === 1 || paths[alias]) continue

    const directTargets = (Array.isArray(targets) ? targets : [targets])
      .filter((target) => typeof target === "string")
      .map((target) => {
        const wildcard = target.indexOf("*")
        return wildcard === -1 ? target : target.slice(0, wildcard).replace(/\/$/u, "")
      })
      .filter(Boolean)
    if (!directTargets.length) continue
    paths[alias] = directTargets
    changed = true
  }

  if (!paths["@/*"] && !hasInheritedRootAlias) {
    const relativeSourceRoot = projectPath(path.relative(baseUrl, path.resolve(projectRoot(), detectSourceRoot() || ".")))
    paths["@/*"] = [relativeSourceRoot
      ? `${relativeSourceRoot.startsWith(".") ? relativeSourceRoot : `./${relativeSourceRoot}`}/*`
      : "./*"]
    changed = true
  }

  if (!changed) return

  config.compilerOptions = {
    ...compilerOptions,
    baseUrl: tsBaseUrlValue(file, baseUrl),
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
  if (!isRuntimeAlias(value)) return ""
  const { mapping, normalized } = aliasMappingFor(value)
  if (/^[@~#]/u.test(normalized) && !mapping) return ""
  const target = aliasToPath(value)
  return target && isSafeProjectPath(target) ? value : ""
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
  for (const candidate of ["", "src", "app", "client/src"]) {
    if (isSafeProjectPath(candidate) && isDirectory(candidate || ".") && !roots.includes(candidate)) roots.push(candidate)
  }
  return roots
}

function detectAliasedUiDirectory() {
  for (const mapping of projectAliasMappings()) {
    const aliasName = mapping.aliasPrefix.replace(/\/$/u, "").split("/").pop().replace(/^[@~#]/u, "").toLowerCase()
    if (["ui", "primitives"].includes(aliasName) && isReusableProjectPath(mapping.targetPrefix)) return mapping.targetPrefix
    if (["component", "components", "design-system", "designsystem"].includes(aliasName)) {
      const candidate = joinProjectPath(mapping.targetPrefix, "ui")
      if (isReusableProjectPath(candidate)) return candidate
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
      if (isReusableProjectPath(candidate) && hasRuntimeAliasForPath(candidate) && isDirectory(candidate)) return candidate
    }
  }

  for (const sourceRoot of componentSourceRoots()) {
    for (const directory of componentDirectories) {
      const candidate = joinProjectPath(sourceRoot, directory)
      const ui = joinProjectPath(candidate, "ui")
      if (isReusableProjectPath(candidate) && hasRuntimeAliasForPath(ui) && isDirectory(candidate)) return ui
    }
    for (const directory of commonRoots) {
      const candidate = joinProjectPath(sourceRoot, directory)
      const ui = joinProjectPath(candidate, "components", "ui")
      if (isReusableProjectPath(candidate) && hasRuntimeAliasForPath(ui) && isDirectory(candidate)) return ui
    }
  }

  return ""
}

function detectComponentLayout(config) {
  const configuredUiCandidate = configuredAliasPath(config, "ui")
  const configuredComponentsCandidate = configuredAliasPath(config, "components")
  const configuredUi = isReusableProjectPath(configuredUiCandidate) ? configuredUiCandidate : ""
  const configuredComponents = isReusableProjectPath(configuredComponentsCandidate) ? configuredComponentsCandidate : ""
  const ui = configuredUi ||
    (configuredComponents ? joinProjectPath(configuredComponents, "ui") : "") ||
    detectAliasedUiDirectory() ||
    detectExistingUiDirectory() ||
    joinProjectPath(detectSourceRoot(), "components", "ui")
  if (!isReusableProjectPath(ui)) {
    throw new Error(`coss bootstrap could not resolve a project-local shared UI directory: ${ui || "(empty)"}`)
  }
  if (!hasRuntimeAliasForPath(ui)) {
    throw new Error(`coss bootstrap requires an import alias for the shared UI directory: ${ui}`)
  }
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

function ensureComponentsConfig(options = {}) {
  const config = readJson("components.json", {})
  const configuredCss = config.tailwind && config.tailwind.css
  const cssFile = tailwindCssCandidates().find((file) => isSafeProjectPath(file) && fs.existsSync(file)) ||
    joinProjectPath(detectSourceRoot(), "index.css")
  assertSafeProjectWritePath(cssFile, "the Tailwind CSS entry")

  config.style = config.style || "new-york"
  config.rsc = typeof config.rsc === "boolean" ? config.rsc : detectUiProjectType() === "next"
  config.tsx = typeof config.tsx === "boolean" ? config.tsx : projectConfigFiles().some((file) => path.basename(file).startsWith("tsconfig"))
  config.tailwind = {
    css: cssFile,
    baseColor: "neutral",
    cssVariables: true,
    ...(config.tailwind || {}),
  }
  if (typeof configuredCss === "string" && configuredCss) {
    assertSafeProjectWritePath(configuredCss, "the Tailwind CSS entry")
    config.tailwind.css = configuredCss
  } else {
    config.tailwind.css = cssFile
  }
  config.iconLibrary = config.iconLibrary || "lucide"
  config.aliases = config.aliases || {}
  const layout = detectComponentLayout(config)
  const existingAliases = config.aliases || {}
  const existingComponents = configuredAlias(existingAliases, "components")
  const existingUi = configuredAlias(existingAliases, "ui")
  const existingUtils = configuredAlias(existingAliases, "utils")
  const existingLib = configuredAlias(existingAliases, "lib")
  const existingHooks = configuredAlias(existingAliases, "hooks")
  const reusableComponents = isReusableProjectPath(aliasToPath(existingComponents)) ? existingComponents : ""
  const reusableUi = isReusableProjectPath(aliasToPath(existingUi)) ? existingUi : ""

  config.$schema = config.$schema || "https://ui.shadcn.com/schema.json"
  config.aliases = {
    ...existingAliases,
    components: reusableComponents || pathToAlias(layout.components),
    ui: reusableUi || pathToAlias(layout.ui),
    utils: existingUtils || pathToAlias(withoutTs(layout.utils)),
    lib: existingLib || pathToAlias(path.dirname(layout.utils)),
    hooks: existingHooks || pathToAlias(layout.hooks),
  }
  config.registries = {
    ...(config.registries || {}),
    [at + "coss"]: "https://coss.com/ui/r/{name}.json",
  }

  const ui = aliasToPath(config.aliases.ui)
  const utils = aliasToPath(config.aliases.utils)
  const hooks = aliasToPath(config.aliases.hooks)
  assertSafeProjectWritePath(ui, "the UI directory")
  assertSafeProjectWritePath(utils, "the utility directory")
  assertSafeProjectWritePath(hooks, "the hooks directory")
  if (!isReusableProjectPath(ui)) {
    throw new Error(`coss bootstrap refuses to use a feature-local UI directory: ${ui}`)
  }
  for (const dir of [ui, path.dirname(`${withoutTs(utils)}.ts`), hooks]) {
    ensureSafeProjectDirectory(dir, "a shared COSS directory")
  }

  writeJson("components.json", config)
  if (!options.deferUtility) ensureUtilityModule({ artifacts: [] })
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
  const roots = Array.isArray(manifest.roots) ? manifest.roots : []
  return roots.map(cleanComponent).filter(Boolean)
}

function installRoots(requested) {
  const mode = String(process.env.COSS_BOOTSTRAP_MODE || "").trim().toLowerCase()
  if (mode && mode !== "fast") {
    throw new Error("coss bootstrap installs primitives and neutral tokens only; run the official coss style setup separately")
  }

  const roots = requested.length ? requested : ["ui"]
  if (roots.includes("style")) {
    throw new Error("coss bootstrap does not install @coss/style; use the official coss style setup separately")
  }
  return [...new Set(roots.concat("colors-neutral", "utils"))]
}

function installSpecs(plan) {
  return plan.roots.map((name) => at + "coss/" + name)
}

function sourceFile(file) {
  const candidates = [file, `${file}.ts`, `${file}.tsx`, `${file}.js`, `${file}.jsx`]
    .concat(["ts", "tsx", "js", "jsx"].map((extension) => path.join(file, `index.${extension}`)))
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue
    try {
      if (fs.lstatSync(candidate).isDirectory()) continue
    } catch {
      throw new Error(`coss bootstrap refuses to read an unsafe project file: ${normalizePath(candidate)}`)
    }
    if (!isSafeProjectFile(candidate)) {
      throw new Error(`coss bootstrap refuses to read an unsafe project file: ${normalizePath(candidate)}`)
    }
    return candidate
  }
  return ""
}

function ensureUtilityModule(plan) {
  const config = readJson("components.json", { aliases: {} })
  const utils = aliasToPath((config.aliases || {}).utils || "")
  if (!utils || !isSafeProjectPath(utils)) {
    throw new Error("coss bootstrap could not resolve the utility module path")
  }
  const utilityBase = withoutTs(utils)
  if (plan.artifacts.some((artifact) => withoutTs(artifact.target) === utilityBase)) return
  if (sourceFile(utilityBase)) return

  const utilsFile = `${utilityBase}${config.tsx === false ? ".js" : ".ts"}`
  const lines = config.tsx === false
    ? [
      "import { clsx } from 'clsx';",
      "import { twMerge } from 'tailwind-merge';",
      "",
      "export function cn(...inputs) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
    ]
    : [
      "import { clsx, type ClassValue } from 'clsx';",
      "import { twMerge } from 'tailwind-merge';",
      "",
      "export function cn(...inputs: ClassValue[]) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
    ]
  assertSafeProjectWritePath(utilsFile, "the utility module")
  fs.writeFileSync(utilsFile, lines.join("\n"))
}

function componentFile(ui, name) {
  return sourceFile(path.join(ui, name))
}

function componentFileExists(ui, name) {
  return Boolean(componentFile(ui, name))
}

function sameStringSet(left, right) {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort())
}

function sameProjectPathSet(left, right) {
  const normalize = (paths) => paths.map(projectPathKey)
  const leftPaths = normalize(left)
  const rightPaths = normalize(right)
  return new Set(leftPaths).size === leftPaths.length &&
    new Set(rightPaths).size === rightPaths.length &&
    sameStringSet(leftPaths, rightPaths)
}

function trackedFileHash(files, target) {
  const matches = Object.keys(files || {}).filter((file) => projectPathKey(file) === projectPathKey(target))
  return matches.length === 1 ? files[matches[0]] : ""
}

function projectFileHash(file) {
  if (!isSafeProjectFile(file)) return ""
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function cossRegistryItemName(value) {
  const prefix = `${at}coss/`
  return typeof value === "string" && value.startsWith(prefix) ? cleanComponent(value) : ""
}

function fetchJson(url, redirects = 0) {
  const target = new URL(url)
  if (target.protocol !== "https:" || target.hostname !== "coss.com") {
    return Promise.reject(new Error(`coss bootstrap refuses an untrusted registry URL: ${url}`))
  }

  return new Promise((resolve, reject) => {
    const request = https.get(target, { headers: { accept: "application/json" } }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location && redirects < 3) {
        response.resume()
        resolve(fetchJson(new URL(response.headers.location, target).toString(), redirects + 1))
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error(`coss registry returned HTTP ${status} for ${target.pathname}`))
        return
      }

      const chunks = []
      response.on("data", (chunk) => chunks.push(chunk))
      response.on("error", reject)
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
        } catch {
          reject(new Error(`coss registry returned invalid JSON for ${target.pathname}`))
        }
      })
    })
    request.setTimeout(15000, () => request.destroy(new Error(`coss registry request timed out for ${target.pathname}`)))
    request.on("error", reject)
  })
}

async function fetchCossRegistryItem(name) {
  const itemName = cleanComponent(name)
  if (!itemName) throw new Error(`coss bootstrap received an invalid registry item name: ${name}`)
  const item = await fetchJson(`https://coss.com/ui/r/${encodeURIComponent(itemName)}.json`)
  if (!item || item.name !== itemName) {
    throw new Error(`coss registry returned an unexpected item for @coss/${itemName}`)
  }
  return item
}

function registryAliasForFileType(type) {
  return {
    "registry:component": "components",
    "registry:hook": "hooks",
    "registry:lib": "lib",
    "registry:ui": "ui",
  }[type] || ""
}

function registryArtifactTarget(config, item, file) {
  const type = typeof file.type === "string" ? file.type : item.type
  let aliasName = registryAliasForFileType(type)
  let relative = ""
  const explicitTarget = typeof file.target === "string" ? normalizePath(file.target) : ""

  if (explicitTarget) {
    const targetMatch = explicitTarget.match(/^@(components|hooks|lib|ui)\/(.+)$/u)
    if (!targetMatch) {
      throw new Error(`coss registry item @coss/${item.name} has an unsupported file target: ${explicitTarget}`)
    }
    aliasName = targetMatch[1]
    relative = targetMatch[2]
  } else {
    const source = normalizePath(file.path)
    const folder = String(type || "").replace(/^registry:/u, "")
    const marker = `/${folder}/`
    const markerIndex = source.lastIndexOf(marker)
    relative = markerIndex === -1 ? path.basename(source) : source.slice(markerIndex + marker.length)
  }

  const alias = (config.aliases || {})[aliasName]
  const directory = aliasToPath(alias)
  if (!aliasName || !directory || !isSafeProjectPath(directory)) {
    throw new Error(`coss bootstrap could not resolve the ${type} target for @coss/${item.name}`)
  }

  const targetRelative = projectPath(relative)
  if (!targetRelative || targetRelative.split("/").includes("..")) {
    throw new Error(`coss registry item @coss/${item.name} has an unsafe file path: ${relative}`)
  }
  const target = joinProjectPath(directory, config.tsx === false
    ? targetRelative.replace(/\.tsx$/u, ".jsx").replace(/\.ts$/u, ".js")
    : targetRelative)
  assertSafeProjectWritePath(target, `the @coss/${item.name} output`)
  return target
}

async function resolveCossInstallPlan(requested, fetchRegistryItem = fetchCossRegistryItem) {
  const roots = installRoots(requested)
  const queue = [...roots]
  const items = []
  const seen = new Set()
  const queued = new Set(queue)

  while (queue.length) {
    const names = queue.splice(0, 8).map(cleanComponent).filter((name) => name && !seen.has(name))
    for (const name of names) seen.add(name)
    const batch = await Promise.all(names.map(async (name) => {
      const item = await fetchRegistryItem(name)
      if (!item || item.name !== name) {
        throw new Error(`coss registry item @coss/${name} is invalid`)
      }
      if (item.type === "registry:block") {
        throw new Error(`coss bootstrap supports COSS primitives only; @coss/${name} is a registry block`)
      }
      return item
    }))

    for (const item of batch) {
      items.push(item)
      for (const dependency of Array.isArray(item.registryDependencies) ? item.registryDependencies : []) {
        const cossDependency = cossRegistryItemName(dependency)
        if (cossDependency && !seen.has(cossDependency) && !queued.has(cossDependency)) {
          queue.push(cossDependency)
          queued.add(cossDependency)
        }
      }
    }
  }

  const config = readJson("components.json", { aliases: {} })
  const byTarget = new Map()
  const runtimeDependencies = new Set()
  for (const item of items) {
    for (const dependency of item.dependencies || []) {
      if (typeof dependency === "string" && dependency) runtimeDependencies.add(dependency)
    }
    for (const file of item.files || []) {
      if (!file || typeof file.path !== "string") continue
      const target = registryArtifactTarget(config, item, file)
      const sourceHash = typeof file.content === "string"
        ? crypto.createHash("sha256").update(file.content).digest("hex")
        : ""
      const key = projectPathKey(target)
      const existing = byTarget.get(key)
      if (existing && (existing.target !== target || (existing.sourceHash && sourceHash && existing.sourceHash !== sourceHash))) {
        throw new Error(`coss registry items conflict on ${target}: @coss/${existing.item} and @coss/${item.name}`)
      }
      if (existing) existing.items.push(item.name)
      else byTarget.set(key, { target, item: item.name, items: [item.name], sourceHash })
    }
  }

  return {
    roots,
    registryItems: items.map((item) => item.name).sort(),
    runtimeDependencies: [...runtimeDependencies].sort(),
    artifacts: [...byTarget.values()].sort((left, right) => left.target.localeCompare(right.target)),
    changesCss: items.some((item) => item.css || item.cssVars),
  }
}

function artifactFileCandidates(target) {
  const extension = path.extname(target)
  if (![".ts", ".tsx", ".js", ".jsx"].includes(extension)) return [target]
  const stem = target.slice(0, -extension.length)
  return [...new Set([target, ...[".ts", ".tsx", ".js", ".jsx"].map((candidate) => `${stem}${candidate}`)])]
}

function cossInstallStateMatches(plan) {
  const state = readJson(COSS_INSTALL_MANIFEST, {})
  if (state.version !== 2 || !state.files || typeof state.files !== "object") return false
  if (!sameStringSet(state.roots || [], plan.roots) || !sameStringSet(state.registryItems || [], plan.registryItems)) return false
  const targets = plan.artifacts.map((artifact) => artifact.target)
  if (!sameProjectPathSet(Object.keys(state.files), targets)) return false
  if (!targets.every((target) => trackedFileHash(state.files, target) === projectFileHash(target))) return false
  if (!plan.changesCss) return true

  const config = readJson("components.json", {})
  const cssFile = config.tailwind && config.tailwind.css
  return Boolean(typeof cssFile === "string" && state.css && typeof state.css === "object" &&
    typeof state.css.path === "string" &&
    projectPathKey(state.css.path) === projectPathKey(cssFile) &&
    state.css.hash === projectFileHash(cssFile))
}

function assertNoArtifactConflicts(plan) {
  const state = readJson(COSS_INSTALL_MANIFEST, {})
  const trackedFiles = state.files && typeof state.files === "object" ? state.files : {}
  const conflicts = []

  for (const artifact of plan.artifacts) {
    for (const candidate of artifactFileCandidates(artifact.target)) {
      if (!fs.existsSync(candidate)) continue
      if (!isSafeProjectFile(candidate)) {
        throw new Error(`coss bootstrap refuses to install through an unsafe artifact path: ${normalizePath(candidate)}`)
      }
      if (projectPathKey(candidate) !== projectPathKey(artifact.target) ||
        trackedFileHash(trackedFiles, candidate) !== projectFileHash(candidate)) {
        conflicts.push(normalizePath(candidate))
      }
    }
  }

  if (conflicts.length) {
    throw new Error(
      `coss bootstrap refuses to install over existing untracked registry files: ${[...new Set(conflicts)].join(", ")}`,
    )
  }
}

function configuredTailwindCssFile() {
  const config = readJson("components.json", {})
  return config.tailwind && typeof config.tailwind.css === "string" ? config.tailwind.css : ""
}

function assertPlanWritePaths(plan) {
  for (const artifact of plan.artifacts) {
    assertSafeProjectWritePath(artifact.target, `the @coss/${artifact.item} output`)
  }
  if (plan.changesCss) {
    const cssFile = configuredTailwindCssFile()
    if (!cssFile) throw new Error("coss bootstrap could not resolve the Tailwind CSS entry for COSS tokens")
    assertSafeProjectWritePath(cssFile, "the Tailwind CSS entry")
  }
}

function packageNameFromSpecifier(specifier) {
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

function importStatusForFiles(files) {
  const missing = []
  const external = new Set()
  const importPattern = /(?:from\s*|import\s*)["']([^"']+)["']/gu
  const queue = files.map((entry) => typeof entry === "string"
    ? { file: entry, label: path.basename(entry) }
    : entry)
  const visited = new Set()

  while (queue.length) {
    const current = queue.shift()
    const file = current.file
    const key = normalizePath(file).toLowerCase()
    if (visited.has(key)) continue
    visited.add(key)
    if (!isSafeProjectFile(file)) {
      missing.push(`${current.label}: ${normalizePath(file)}`)
      continue
    }

    const source = fs.readFileSync(file, "utf8")
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1]
      const aliasMapping = aliasMappingFor(specifier).mapping
      const localFile = specifier.startsWith(".")
        ? projectPath(path.relative(process.cwd(), path.resolve(path.dirname(file), specifier)))
        : (aliasMapping ? aliasToPath(specifier) : "")
      if (localFile) {
        const resolved = sourceFile(localFile)
        if (!resolved) missing.push(`${current.label}: ${specifier}`)
        else queue.push({ file: resolved, label: current.label })
      } else if (specifier.startsWith(`${at}/`) || specifier.startsWith("~") || specifier.startsWith("#")) {
        missing.push(`${current.label}: ${specifier}`)
      } else if (!specifier.startsWith("node:")) {
        external.add(packageNameFromSpecifier(specifier))
      }
    }
  }

  return {
    missingProjectImports: [...new Set(missing)],
    missingRuntimeDependencies: [...external].filter((name) => !hasDependency(name)),
  }
}

function componentImportStatus(ui, components) {
  const files = components.flatMap((component) => {
    const file = componentFile(ui, component)
    return file ? [{ file, label: component }] : []
  })
  return importStatusForFiles(files)
}

function missingProjectImports(ui, components) {
  return componentImportStatus(ui, components).missingProjectImports
}

function cossArtifactStatus(plan) {
  const config = readJson("components.json", { aliases: {} })
  const ui = aliasToPath((config.aliases || {}).ui || "src/components/ui")
  const utils = aliasToPath((config.aliases || {}).utils || "src/lib/utils")
  const registry = (config.registries || {})[at + "coss"]
  const registryUrl = typeof registry === "string" ? registry : registry && registry.url
  const utilsFile = sourceFile(utils)
  const missingArtifacts = plan.artifacts.filter((artifact) => !isSafeProjectFile(artifact.target))
  const importFiles = plan.artifacts
    .filter((artifact) => isSafeProjectFile(artifact.target))
    .map((artifact) => ({ file: artifact.target, label: `@coss/${artifact.item}` }))
  if (utilsFile) importFiles.push({ file: utilsFile, label: "coss utility" })
  const importStatus = importStatusForFiles(importFiles)
  const missingDependencies = new Set(importStatus.missingRuntimeDependencies)
  for (const dependency of plan.runtimeDependencies) {
    if (!hasDependency(dependency)) missingDependencies.add(dependency)
  }

  return {
    expected: plan.registryItems,
    hasInstallState: cossInstallStateMatches(plan),
    hasOfficialRegistry: registryUrl === "https://coss.com/ui/r/{name}.json",
    hasUtils: Boolean(utilsFile),
    missingArtifacts,
    missingDependencies: [...missingDependencies].sort(),
    missingProjectImports: importStatus.missingProjectImports,
    ui,
    utils,
  }
}

function cossArtifactsReady(plan, requireInstallState = true) {
  const status = cossArtifactStatus(plan)
  return (!requireInstallState || status.hasInstallState) &&
    status.hasOfficialRegistry &&
    status.hasUtils &&
    !status.missingArtifacts.length &&
    !status.missingProjectImports.length &&
    !status.missingDependencies.length
}

function cossArtifactsError(plan, requireInstallState = true) {
  const status = cossArtifactStatus(plan)
  const problems = []

  if (requireInstallState && !status.hasInstallState) {
    problems.push(`missing matching ${COSS_INSTALL_MANIFEST} installation state`)
  }
  if (!status.hasOfficialRegistry) {
    problems.push('components.json registries["@coss"] must be https://coss.com/ui/r/{name}.json')
  }
  if (!status.hasUtils) problems.push(`missing coss utility module at ${status.utils}`)
  if (status.missingArtifacts.length) {
    problems.push(`missing tracked COSS registry files: ${status.missingArtifacts.map((artifact) => artifact.target).join(", ")}`)
  }
  if (status.missingProjectImports.length) {
    problems.push(`broken generated local imports: ${status.missingProjectImports.join(", ")}`)
  }
  if (status.missingDependencies.length) {
    problems.push(`missing runtime dependencies: ${status.missingDependencies.join(", ")}`)
  }

  return `coss UI verification failed: ${problems.join("; ")}`
}

function assertCossArtifactsReady(plan, requireInstallState = true) {
  if (!cossArtifactsReady(plan, requireInstallState)) {
    throw new Error(cossArtifactsError(plan, requireInstallState))
  }
}

function writeCossInstallState(plan) {
  const state = {
    version: 2,
    roots: plan.roots,
    registryItems: plan.registryItems,
    files: Object.fromEntries(plan.artifacts.map((artifact) => [artifact.target, projectFileHash(artifact.target)])),
  }
  if (plan.changesCss) {
    const cssFile = configuredTailwindCssFile()
    if (!isSafeProjectFile(cssFile)) {
      throw new Error(`coss bootstrap could not track the Tailwind CSS entry: ${cssFile || "(empty)"}`)
    }
    state.css = { path: cssFile, hash: projectFileHash(cssFile) }
  }
  writeJson(COSS_INSTALL_MANIFEST, state)
}

function verifyCossUi(plan) {
  assertCossArtifactsReady(plan)
  const status = cossArtifactStatus(plan)
  logStatus(`coss tracked registry components verified in ${status.ui}: ${status.expected.join(", ")}`)
}

function installCossUi(plan) {
  assertPlanWritePaths(plan)
  if (cossArtifactsReady(plan)) {
    logStatus("coss ui artifacts and runtime dependencies already present; skipping shadcn add")
    return Promise.resolve()
  }

  assertNoArtifactConflicts(plan)

  const packageManager = detectPackageManager()
  const env = packageManagerEnv(packageManager)
  const specs = installSpecs(plan)
  const [command, args] = shadcnCommand(packageManager, specs)

  return new Promise((resolve, reject) => {
    assertPlanWritePaths(plan)
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
      if (code !== 0) {
        finish(new Error(`coss shadcn exited with code ${code ?? 1}${signal ? ` (${signal})` : ""}`))
        return
      }

      try {
        assertCossArtifactsReady(plan, false)
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
  const projectType = assertSupportedUiProject()
  if (process.argv.includes("--verify")) {
    assertBootstrapReadPaths()
    assertTailwindSetup()
    await assertViteAliasSupport()
    const plan = await resolveCossInstallPlan(verificationComponents())
    verifyCossUi(plan)
    return
  }

  const requested = requestedComponents()
  logStatus(`coss bootstrap detected ${projectType}; resolving shared UI component placement`)
  assertBootstrapWritePaths()
  ensureProjectAliases()
  ensureComponentsConfig({ deferUtility: true })
  assertTailwindSetup()
  const plan = await resolveCossInstallPlan(requested)
  await assertViteAliasSupport()
  ensureUtilityModule(plan)
  await installCossUi(plan)
  writeCossInstallState(plan)
  verifyCossUi(plan)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.message ? error.message : error)
    process.exit(1)
  })
}

module.exports = {
  aliasToPath,
  assertNoArtifactConflicts,
  assertPlanWritePaths,
  assertSupportedUiProject,
  cossInstallStateMatches,
  componentImportStatus,
  detectComponentLayout,
  detectUiProjectType,
  ensureComponentsConfig,
  ensureProjectAliases,
  ensureUtilityModule,
  missingProjectImports,
  resolveCossInstallPlan,
  shadcnCommand,
  viteAliasesHaveRuntimeResolver,
  viteConfigFile,
}
