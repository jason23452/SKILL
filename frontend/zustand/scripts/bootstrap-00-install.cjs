#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const cp = require("child_process")

const cwd = process.cwd()
const nextConfigCandidates = ["next.config.ts", "next.config.js", "next.config.mjs"]
const viteConfigCandidates = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"]
const reactEntryCandidates = [
  path.join("src", "main.tsx"),
  path.join("src", "main.jsx"),
  path.join("main.tsx"),
  path.join("main.jsx"),
]
const nextEntryCandidates = [
  path.join("src", "app", "layout.tsx"),
  path.join("src", "app", "layout.jsx"),
  path.join("src", "app", "layout.ts"),
  path.join("src", "app", "layout.js"),
  path.join("app", "layout.tsx"),
  path.join("app", "layout.jsx"),
  path.join("app", "layout.ts"),
  path.join("app", "layout.js"),
  path.join("src", "pages", "_app.tsx"),
  path.join("src", "pages", "_app.jsx"),
  path.join("src", "pages", "_app.ts"),
  path.join("src", "pages", "_app.js"),
  path.join("pages", "_app.tsx"),
  path.join("pages", "_app.jsx"),
  path.join("pages", "_app.ts"),
  path.join("pages", "_app.js"),
]

function abs(filePath) {
  return path.join(cwd, filePath)
}

function exists(filePath) {
  return fs.existsSync(abs(filePath))
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(abs(filePath), "utf8").replace(/^\uFEFF/u, ""))
  } catch (error) {
    throw new Error(`zustand: could not read ${filePath}: ${error.message}`)
  }
}

function dependencyMap(manifest) {
  return {
    ...(manifest.dependencies || {}),
    ...(manifest.devDependencies || {}),
    ...(manifest.optionalDependencies || {}),
  }
}

function hasDependency(manifest, name) {
  return Boolean(dependencyMap(manifest)[name])
}

function detectPackageManager(manifest) {
  const declared = typeof manifest.packageManager === "string"
    ? manifest.packageManager.split("@")[0]
    : ""

  if (["pnpm", "npm", "yarn", "bun"].includes(declared)) return declared
  if (exists("pnpm-lock.yaml")) return "pnpm"
  if (exists("bun.lock") || exists("bun.lockb")) return "bun"
  if (exists("yarn.lock")) return "yarn"
  if (exists("package-lock.json")) return "npm"
  return "pnpm"
}

function detectTarget(manifest) {
  const hasNext = hasDependency(manifest, "next") ||
    nextConfigCandidates.some(exists) ||
    nextEntryCandidates.some(exists)
  const hasReact = hasDependency(manifest, "react") ||
    reactEntryCandidates.some(exists) ||
    hasNext
  const hasVite = hasDependency(manifest, "vite") || viteConfigCandidates.some(exists)

  if (hasNext) return "next"
  if (hasReact && hasVite) return "react-vite"

  throw new Error("zustand: expected a React SPA Vite or Next.js project; no supported React target was detected.")
}

function installCommand(packageManager, packages) {
  if (packageManager === "npm") return ["npm", ["install", ...packages]]
  if (packageManager === "yarn") return ["yarn", ["add", ...packages]]
  if (packageManager === "bun") return ["bun", ["add", ...packages]]
  return ["pnpm", ["add", ...packages]]
}

function run(command, args) {
  const executable = process.platform === "win32" && !/\.(cmd|exe|bat)$/iu.test(command)
    ? `${command}.cmd`
    : command
  const result = cp.spawnSync(executable, args, {
    stdio: "inherit",
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(" ")} exited with code ${result.status || 1}`)
  }
}

function main() {
  if (!exists("package.json")) {
    throw new Error("zustand: package.json not found.")
  }

  const manifest = readJson("package.json")
  const target = detectTarget(manifest)
  const packageManager = detectPackageManager(manifest)
  const missing = ["zustand"].filter((name) => !hasDependency(manifest, name))

  if (!missing.length) {
    console.log(`zustand: dependencies already present for ${target}.`)
    return
  }

  const [command, args] = installCommand(packageManager, missing)
  console.log(`zustand: installing ${missing.join(" ")} with ${packageManager}.`)
  run(command, args)
}

main()
