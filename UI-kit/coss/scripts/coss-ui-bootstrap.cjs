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
  "@tailwindcss/vite",
  "tailwindcss",
]

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
  return String(value || "").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
}

function readJsonc(file, fallback) {
  try {
    return JSON.parse(stripJsonc(fs.readFileSync(file, "utf8")))
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

function aliasToPath(alias) {
  const normalized = normalizePath(alias)
  return normalized.startsWith(`${at}/`) ? `src/${normalized.slice(2)}` : normalized
}

function pathToAlias(dir) {
  const normalized = normalizePath(dir)
  return normalized.startsWith("src/") ? `${at}/${normalized.slice(4)}` : normalized
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

function ensureTailwindCssEntry() {
  const candidates = ["src/app/global.css", "src/index.css", "src/global.css", "app/assets/css/main.css"]
  const cssFile = candidates.find((file) => fs.existsSync(file)) || "src/index.css"
  fs.mkdirSync(path.dirname(cssFile), { recursive: true })

  const importLine = '@import "tailwindcss";'
  const existing = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf8") : ""
  if (existing.includes('@import "tailwindcss"') || existing.includes("@import 'tailwindcss'")) return cssFile

  fs.writeFileSync(cssFile, `${importLine}\n${existing ? `\n${existing}` : ""}`)
  return cssFile
}

function ensureCssImported(cssFile) {
  const mainFiles = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js"]
  const mainFile = mainFiles.find((file) => fs.existsSync(file))
  if (!mainFile) return

  const content = fs.readFileSync(mainFile, "utf8")
  if (/import\s+["'][^"']*(index|global|main)\.css["'];?/u.test(content)) return

  const relative = normalizePath(path.relative(path.dirname(mainFile), cssFile))
  const importPath = relative.startsWith(".") ? relative : `./${relative}`
  fs.writeFileSync(mainFile, `import "${importPath}";\n${content}`)
}

function ensureViteTailwindPlugin() {
  const file = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"].find((name) => fs.existsSync(name))
  if (!file) return

  let content = fs.readFileSync(file, "utf8")
  if (!content.includes("@tailwindcss/vite")) {
    const importLine = 'import tailwindcss from "@tailwindcss/vite";\n'
    if (/import\s+\{?\s*defineConfig/u.test(content)) {
      content = content.replace(/(import\s+\{?\s*defineConfig[\s\S]*?from\s+["']vite["'];?\n)/u, `$1${importLine}`)
    } else {
      content = `${importLine}${content}`
    }
  }

  if (!content.includes("tailwindcss()")) {
    if (/plugins\s*:\s*\[/u.test(content)) {
      content = content.replace(/plugins\s*:\s*\[/u, "plugins: [tailwindcss(), ")
    } else {
      content = content.replace(/defineConfig\s*\(\s*\{/u, "defineConfig({\n  plugins: [tailwindcss()],")
    }
  }

  fs.writeFileSync(file, content)
}

function ensureTailwindSetup() {
  ensureDevDependencies()
  const cssFile = ensureTailwindCssEntry()
  ensureCssImported(cssFile)
  ensureViteTailwindPlugin()
}

function ensureTsconfigAlias(file) {
  const config = readJsonc(file, null)
  if (!config) return
  config.compilerOptions = {
    ...(config.compilerOptions || {}),
    baseUrl: (config.compilerOptions || {}).baseUrl || ".",
    paths: {
      ...((config.compilerOptions || {}).paths || {}),
      "@/*": ["./src/*"],
    },
  }
  writeJson(file, config)
}

function ensureProjectAliases() {
  for (const file of ["tsconfig.json", "tsconfig.app.json"]) {
    if (fs.existsSync(file)) ensureTsconfigAlias(file)
  }
}

function ensureComponentsConfig() {
  const shared = fs.existsSync("src/shared") || fs.existsSync("src/shared/components") || fs.existsSync("src/shared/hooks")
  const ui = shared ? "src/shared/components/ui" : "src/components/ui"
  const utils = shared ? "src/shared/utils/cn" : "src/lib/utils"
  const hooks = shared ? "src/shared/hooks" : "src/hooks"

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

  const config = readJson("components.json", {
    style: "new-york",
    rsc: false,
    tsx: true,
    tailwind: {
      css: fs.existsSync("src/app/global.css") ? "src/app/global.css" : "src/index.css",
      baseColor: "neutral",
      cssVariables: true,
    },
    iconLibrary: "lucide",
    aliases: {},
  })

  config.$schema = config.$schema || "https://ui.shadcn.com/schema.json"
  config.aliases = {
    ...(config.aliases || {}),
    components: pathToAlias(path.dirname(ui)),
    ui: pathToAlias(ui),
    utils: pathToAlias(withoutTs(utils)),
    hooks: pathToAlias(hooks),
  }
  config.registries = {
    ...(config.registries || {}),
    [at + "coss"]: "https://coss.com/ui/r/{name}.json",
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
    [aliases.hooks || `${at}/hooks`, aliasToPath(aliases.hooks || "src/hooks")],
  ]
  for (const [alias, target] of repairs) {
    const source = normalizePath(alias)
    if (!source.startsWith(`${at}/`) || source === target) continue
    if (moveDirContents(source, target)) {
      logStatus(`coss repair moved ${source} -> ${target}`)
      removeEmptyParents(path.dirname(source), at)
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

function componentFileExists(ui, name) {
  return fs.existsSync(path.join(ui, `${name}.tsx`)) || fs.existsSync(path.join(ui, `${name}.ts`))
}

function cossArtifactsReady(requested) {
  return cossArtifactFilesReady(requested) && REQUIRED_RUNTIME_DEPENDENCIES.every(hasDependency)
}

function cossArtifactFilesReady(requested) {
  const config = readJson("components.json", { aliases: {} })
  const ui = aliasToPath((config.aliases || {}).ui || "src/components/ui")
  const utils = aliasToPath((config.aliases || {}).utils || "src/lib/utils")
  if (!fs.existsSync(ui)) return false

  const expected = expectedUiComponents(requested)
  const registry = (config.registries || {})[at + "coss"] || JSON.stringify(config).includes("coss.com/ui/r/{name}.json")

  return Boolean(registry)
    && (fs.existsSync(utils) || fs.existsSync(`${utils}.ts`))
    && expected.every((name) => componentFileExists(ui, name))
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
    if (!cossArtifactsReady(requested)) throw new Error("coss ui artifacts exist but required runtime dependencies could not be installed")
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
      shell: process.platform === "win32",
    })

    let lastOutputAt = Date.now()
    let done = false

    const finish = (error) => {
      if (done) return
      done = true
      clearInterval(heartbeat)
      if (error) reject(error)
      else resolve()
    }

    const pipe = (stream, output) => stream && stream.on("data", (chunk) => {
      lastOutputAt = Date.now()
      output.write(chunk)
    })
    pipe(child.stdout, process.stdout)
    pipe(child.stderr, process.stderr)

    const heartbeat = setInterval(() => {
      logStatus(`coss shadcn install still running: ${specs.join(" ")}`)
    }, Number(process.env.COSS_SHADCN_HEARTBEAT_MS || 10000))
    if (heartbeat.unref) heartbeat.unref()

    child.on("close", (code) => {
      repairMisplacedAliasArtifacts()
      writeUiIndex()
      try {
        ensureRuntimeDependencies()
      } catch (error) {
        finish(error)
        return
      }
      if (code === 0 || cossArtifactsReady(requested)) finish()
      else finish(new Error(`coss shadcn exited with code ${code || 1}`))
    })
    child.on("error", finish)
  })
}

async function main() {
  ensureProjectAliases()
  ensureTailwindSetup()
  ensureComponentsConfig()
  repairMisplacedAliasArtifacts()
  await installCossUi()
  repairMisplacedAliasArtifacts()
  writeUiIndex()
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
