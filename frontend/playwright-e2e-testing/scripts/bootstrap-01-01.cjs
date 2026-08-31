const fs = require("fs")
const path = require("path")
const childProcess = require("child_process")

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""))
  } catch {
    return fallback
  }
}

function detectPackageManager() {
  if (fs.existsSync("pnpm-lock.yaml")) return "pnpm"
  if (fs.existsSync("bun.lock") || fs.existsSync("bun.lockb")) return "bun"
  if (fs.existsSync("yarn.lock")) return "yarn"
  if (fs.existsSync("package-lock.json")) return "npm"
  return "npm"
}

function hasPackage(pkg, name) {
  return Boolean((pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name])
}

function run(command, args) {
  childProcess.execFileSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || undefined,
    },
  })
}

function installPackage(packageManager) {
  const commands = {
    pnpm: ["pnpm", ["add", "-D", "@playwright/test"]],
    npm: ["npm", ["install", "-D", "@playwright/test"]],
    yarn: ["yarn", ["add", "-D", "@playwright/test"]],
    bun: ["bun", ["add", "-d", "@playwright/test"]],
  }
  const [command, args] = commands[packageManager] || commands.npm
  run(command, args)
}

function playwrightCommand(packageManager) {
  const commands = {
    pnpm: ["pnpm", ["exec", "playwright"]],
    npm: ["npx", ["playwright"]],
    yarn: ["yarn", ["playwright"]],
    bun: ["bunx", ["playwright"]],
  }
  return commands[packageManager] || commands.npm
}

function commandOutput(command, args) {
  try {
    return childProcess.execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return ""
  }
}

function resolvePlaywright() {
  const cwd = process.cwd()
  const globalRoot = commandOutput("npm", ["root", "-g"])
  const bases = [
    cwd,
    path.join(cwd, "node_modules"),
    globalRoot ? path.join(globalRoot, "@playwright", "test") : "",
    globalRoot || "",
  ].filter(Boolean)

  for (const base of bases) {
    try {
      return require.resolve("playwright", { paths: [base] })
    } catch {
      // Try the next resolution base.
    }
  }
  return ""
}

function runPlaywrightInstall(packageManager) {
  const [command, args] = playwrightCommand(packageManager)
  run(command, [...args, "install", "chromium"])
}

if (!fs.existsSync("package.json")) {
  console.log("playwright-e2e-testing: package.json not found; skipped Node Playwright bootstrap.")
  process.exit(0)
}

const packageManager = detectPackageManager()
const pkg = readJson("package.json", {})
if (!hasPackage(pkg, "@playwright/test")) {
  console.log(`playwright-e2e-testing: installing @playwright/test with ${packageManager}.`)
  installPackage(packageManager)
}

const resolved = resolvePlaywright()
if (!resolved) {
  console.log("Playwright package was not resolvable after install; installing Chromium with package runner.")
  runPlaywrightInstall(packageManager)
  process.exit(0)
}

const playwright = require(resolved)
const chromiumPath = playwright.chromium.executablePath()
if (chromiumPath && fs.existsSync(chromiumPath)) {
  console.log(`Playwright Chromium already available: ${chromiumPath}`)
  process.exit(0)
}

console.log(`Playwright Chromium missing at expected path: ${chromiumPath || "unknown"}`)
runPlaywrightInstall(packageManager)
