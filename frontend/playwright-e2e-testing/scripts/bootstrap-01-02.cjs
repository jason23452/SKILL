#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/u, ""))
  } catch {
    return fallback
  }
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

function writeFileIfMissing(filePath, contents) {
  if (fs.existsSync(filePath)) {
    console.log(`playwright-e2e-testing: kept existing ${filePath}`)
    return
  }
  writeFile(filePath, contents)
}

function hasPackage(pkg, name) {
  return Boolean((pkg.dependencies || {})[name] || (pkg.devDependencies || {})[name])
}

function detectPackageManager() {
  if (fs.existsSync("pnpm-lock.yaml")) return "pnpm"
  if (fs.existsSync("bun.lock") || fs.existsSync("bun.lockb")) return "bun"
  if (fs.existsSync("yarn.lock")) return "yarn"
  if (fs.existsSync("package-lock.json")) return "npm"
  return "npm"
}

function detectFramework(pkg) {
  if (hasPackage(pkg, "nuxt")) return "nuxt"
  if (hasPackage(pkg, "next")) return "next"
  if (hasPackage(pkg, "@sveltejs/kit")) return "sveltekit"
  if (hasPackage(pkg, "astro")) return "astro"
  if (hasPackage(pkg, "@angular/core") || hasPackage(pkg, "@angular/cli")) return "angular"
  if (hasPackage(pkg, "vite") || hasPackage(pkg, "@vitejs/plugin-react") || hasPackage(pkg, "@vitejs/plugin-vue")) return "vite"
  return "generic"
}

function packageRunCommand(packageManager, script, args = "") {
  const suffix = args ? ` ${args}` : ""
  if (packageManager === "pnpm") return `pnpm ${script}${suffix}`
  if (packageManager === "yarn") return `yarn ${script}${suffix}`
  if (packageManager === "bun") return `bun run ${script}${suffix}`
  return `npm run ${script}${suffix}`
}

function packageExecPrefix(packageManager) {
  if (packageManager === "pnpm") return "pnpm exec"
  if (packageManager === "yarn") return "yarn"
  if (packageManager === "bun") return "bunx"
  return "npx"
}

const pkg = readJson("package.json", {})
pkg.scripts = {
  ...(pkg.scripts || {}),
  e2e: "playwright test",
  "e2e:list": "playwright test --list",
}
fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`)

const framework = detectFramework(pkg)
const packageManager = detectPackageManager()
const defaultPort = {
  nuxt: "3000",
  next: "3000",
  sveltekit: "5173",
  astro: "4321",
  angular: "4200",
  vite: "5173",
  generic: "5173",
}[framework] || "5173"
const execPrefix = packageExecPrefix(packageManager)
const devScriptCommand = pkg.scripts?.dev
  ? packageRunCommand(packageManager, "dev", "-- --host 127.0.0.1 --port ${port}")
  : ""

writeFileIfMissing("playwright.config.ts", `import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "${defaultPort}";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? \`http://127.0.0.1:\${port}\`;
const detectedFramework = ${JSON.stringify(framework)};
const packageManager = ${JSON.stringify(packageManager)};
const execPrefix = ${JSON.stringify(execPrefix)};
const devScriptCommand = ${JSON.stringify(devScriptCommand)};
const hasNuxtHealthRoute = existsSync("server/api/health.get.ts") || existsSync("server/api/health.ts");
const webServerURL = process.env.PLAYWRIGHT_WEB_SERVER_URL ?? (detectedFramework === "nuxt" && hasNuxtHealthRoute ? \`\${baseURL}/api/health\` : baseURL);

function nuxtSandboxWebServerCommand() {
  const localScript = ".opencode/skills/nuxt4-creater/scripts/runtime-smoke-sandbox.cjs";
  const preseedRoot = process.env.OPENCODE_PROJECT_SKILLS_PRESEEDED_DIR ?? "/app/.opencode/skills";
  const preseedScript = \`\${preseedRoot}/nuxt4-creater/scripts/runtime-smoke-sandbox.cjs\`;
  const fallback = \`\${execPrefix} nuxt dev --host 127.0.0.1 --port \${port} --no-fork\`;
  return \`if test -f "\${localScript}"; then node "\${localScript}" --cwd . --port \${port}; elif test -f "\${preseedScript}"; then node "\${preseedScript}" --cwd . --port \${port}; else \${fallback}; fi\`;
}

function defaultWebServerCommand() {
  if (process.env.PLAYWRIGHT_WEB_SERVER_COMMAND) return process.env.PLAYWRIGHT_WEB_SERVER_COMMAND;
  if (detectedFramework === "nuxt") return nuxtSandboxWebServerCommand();
  if (detectedFramework === "next") return \`\${execPrefix} next dev -H 127.0.0.1 -p \${port}\`;
  if (detectedFramework === "sveltekit") return \`\${execPrefix} vite dev --host 127.0.0.1 --port \${port} --strictPort\`;
  if (detectedFramework === "astro") return \`\${execPrefix} astro dev --host 127.0.0.1 --port \${port}\`;
  if (detectedFramework === "angular") return \`\${execPrefix} ng serve --host 127.0.0.1 --port \${port}\`;
  if (detectedFramework === "vite") return \`\${execPrefix} vite --host 127.0.0.1 --port \${port} --strictPort\`;
  if (devScriptCommand) return devScriptCommand.replace("$"+"{port}", port);
  if (packageManager === "pnpm") return \`pnpm dev -- --host 127.0.0.1 --port \${port}\`;
  if (packageManager === "yarn") return \`yarn dev --host 127.0.0.1 --port \${port}\`;
  if (packageManager === "bun") return \`bun run dev -- --host 127.0.0.1 --port \${port}\`;
  return \`npm run dev -- --host 127.0.0.1 --port \${port}\`;
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: defaultWebServerCommand(),
    url: webServerURL,
    timeout: Number(process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS ?? 120000),
    reuseExistingServer: !process.env.CI,
  },
});
`)

writeFileIfMissing("tests/home.spec.ts", `import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("body")).not.toHaveText(/^\\s*$/);
});
`)

console.log(`playwright-e2e-testing: detected ${framework} with ${packageManager}`)
