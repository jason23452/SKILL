#!/usr/bin/env node

const fs = require("fs")
const { spawnSync } = require("child_process")

function exists(filePath) {
  return fs.existsSync(filePath)
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"))
  } catch {
    return fallback
  }
}

function detectPackageManager() {
  if (exists("pnpm-lock.yaml")) return "pnpm"
  if (exists("bun.lock") || exists("bun.lockb")) return "bun"
  if (exists("yarn.lock")) return "yarn"
  if (exists("package-lock.json")) return "npm"
  return "pnpm"
}

function hasPackage(name) {
  const manifest = readJson("package.json")
  return Boolean((manifest.dependencies || {})[name] || (manifest.devDependencies || {})[name])
}

function installPackage(name) {
  if (!exists("package.json")) {
    console.log(`axios-token-baseurl-error: package.json not found; skipped ${name} install.`)
    return
  }

  if (hasPackage(name)) {
    console.log(`axios-token-baseurl-error: ${name} already installed.`)
    return
  }

  const packageManager = detectPackageManager()
  const commands = {
    pnpm: ["pnpm", ["add", name]],
    npm: ["npm", ["install", name]],
    yarn: ["yarn", ["add", name]],
    bun: ["bun", ["add", name]],
  }
  const [command, args] = commands[packageManager]

  console.log(`axios-token-baseurl-error: installing ${name} with ${packageManager}.`)
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  })

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

function isNuxtProject() {
  if (exists("nuxt.config.ts") || exists("nuxt.config.js") || exists("nuxt.config.mjs")) return true
  if (!exists("package.json")) return false

  try {
    const manifest = readJson("package.json")
    return Boolean(manifest.dependencies?.nuxt || manifest.devDependencies?.nuxt)
  } catch {
    return false
  }
}

if (isNuxtProject()) {
  console.log("axios-token-baseurl-error: Nuxt detected; using built-in $fetch.")
  process.exit(0)
}

installPackage("axios")
