#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const cwd = process.cwd()
const nextConfigCandidates = ["next.config.ts", "next.config.js", "next.config.mjs"]
const viteConfigCandidates = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"]
const reactEntryCandidates = [
  path.join("src", "main.tsx"),
  path.join("src", "main.jsx"),
  path.join("main.tsx"),
  path.join("main.jsx"),
]
const appLayoutCandidates = [
  path.join("src", "app", "layout.tsx"),
  path.join("src", "app", "layout.jsx"),
  path.join("src", "app", "layout.ts"),
  path.join("src", "app", "layout.js"),
  path.join("app", "layout.tsx"),
  path.join("app", "layout.jsx"),
  path.join("app", "layout.ts"),
  path.join("app", "layout.js"),
]
const pagesAppCandidates = [
  path.join("src", "pages", "_app.tsx"),
  path.join("src", "pages", "_app.jsx"),
  path.join("src", "pages", "_app.ts"),
  path.join("src", "pages", "_app.js"),
  path.join("pages", "_app.tsx"),
  path.join("pages", "_app.jsx"),
  path.join("pages", "_app.ts"),
  path.join("pages", "_app.js"),
]
const appStoreFileNames = ["app-store.ts", "app-store.js", "app-store.tsx", "app-store.jsx"]
const storeFilePattern = /^[a-z0-9][a-z0-9-]*-store\.(ts|js|tsx|jsx)$/u
const providerCandidates = [
  path.join("src", "providers", "app-store-provider.tsx"),
  path.join("src", "providers", "app-store-provider.jsx"),
  path.join("providers", "app-store-provider.tsx"),
  path.join("providers", "app-store-provider.jsx"),
]

function abs(filePath) {
  return path.join(cwd, filePath)
}

function exists(filePath) {
  return fs.existsSync(abs(filePath))
}

function read(filePath) {
  return fs.readFileSync(abs(filePath), "utf8").replace(/^\uFEFF/u, "")
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(read(filePath))
  } catch {
    return fallback
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

function fail(message) {
  console.error(`zustand verification failed: ${message}`)
  process.exit(1)
}

function detectTarget(manifest) {
  const hasNext = hasDependency(manifest, "next") ||
    nextConfigCandidates.some(exists) ||
    appLayoutCandidates.some(exists) ||
    pagesAppCandidates.some(exists)
  const hasReact = hasDependency(manifest, "react") ||
    reactEntryCandidates.some(exists) ||
    hasNext
  const hasVite = hasDependency(manifest, "vite") || viteConfigCandidates.some(exists)

  if (hasNext) return "next"
  if (hasReact && hasVite) return "react-vite"

  fail("expected a React SPA Vite or Next.js project; no supported React target was detected.")
}

function firstExisting(candidates) {
  return candidates.find(exists)
}

function storeFileCandidates(storeDirs) {
  const candidates = []
  for (const storeDir of storeDirs) {
    candidates.push(...appStoreFileNames.map((fileName) => path.join(storeDir, fileName)))

    if (!exists(storeDir)) continue

    candidates.push(
      ...fs.readdirSync(abs(storeDir), { withFileTypes: true })
        .filter((entry) => entry.isFile() && storeFilePattern.test(entry.name))
        .map((entry) => path.join(storeDir, entry.name)),
    )
  }

  return [...new Set(candidates)]
}

function unique(items) {
  return [...new Set(items)]
}

function rootPath(root, ...segments) {
  return root === "." ? path.join(...segments) : path.join(root, ...segments)
}

function sharedFeaturesLayoutRoots() {
  return ["src", "."].filter((root) => {
    return (root === "." || exists(root)) &&
      (exists(rootPath(root, "features")) || exists(rootPath(root, "shared")))
  })
}

function hasSharedFeaturesBasedLayout() {
  return sharedFeaturesLayoutRoots().length > 0
}

function sourceLayerDirs(layerName) {
  return sharedFeaturesLayoutRoots()
    .map((root) => rootPath(root, layerName))
    .filter(exists)
}

function featureStoreDirs() {
  const featureRoots = sourceLayerDirs("features")
  const dirs = []

  for (const featureRoot of featureRoots) {
    dirs.push(
      ...fs.readdirSync(abs(featureRoot), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(featureRoot, entry.name, "store")),
    )
  }

  return dirs
}

function storeDirCandidates() {
  const candidates = [
    ...sharedFeaturesLayoutRoots().map((root) => rootPath(root, "shared", "store")),
    ...featureStoreDirs(),
  ]

  if (!hasSharedFeaturesBasedLayout()) {
    candidates.push(path.join("src", "store"), "store", path.join("src", "app", "store"), path.join("app", "store"))
  }

  return unique(candidates)
}

function reactViteStoreCandidates() {
  return storeFileCandidates(storeDirCandidates())
}

function nextStoreCandidates() {
  return storeFileCandidates(storeDirCandidates())
}

function verifyReactVite(manifest) {
  if (!hasDependency(manifest, "zustand")) fail("zustand is missing from package dependencies.")

  const storePath = firstExisting(reactViteStoreCandidates())
  if (!storePath) {
    fail("store file is missing. In shared/features based layouts, shared stores belong in src/shared/store or shared/store, and feature stores belong in src/features/<feature>/store or features/<feature>/store; do not place shared stores under app/store, src/app/store, src/store, or store.")
  }

  const source = read(storePath)
  if (!/from\s*["']zustand["']/u.test(source) || !/\bcreate\s*</u.test(source) && !/\bcreate\s*\(/u.test(source)) {
    fail(`${storePath} does not define a Zustand hook store with create(...).`)
  }

  console.log(`zustand verification passed: React Vite dependency and store ${storePath} are configured.`)
}

function verifyNext(manifest) {
  if (!hasDependency(manifest, "zustand")) fail("zustand is missing from package dependencies.")

  const storePath = firstExisting(nextStoreCandidates())
  if (!storePath) {
    fail("store file is missing. In shared/features based layouts, shared stores belong in src/shared/store or shared/store, and feature stores belong in src/features/<feature>/store or features/<feature>/store; do not place shared stores under app/store, src/app/store, src/store, or store.")
  }

  const storeSource = read(storePath)
  if (!/from\s*["']zustand\/vanilla["']/u.test(storeSource) || !/\bcreateStore\s*</u.test(storeSource) && !/\bcreateStore\s*\(/u.test(storeSource)) {
    fail(`${storePath} does not define a per-request vanilla store with createStore(...).`)
  }

  const providerPath = firstExisting(providerCandidates)
  if (!providerPath) fail("app-store-provider file is missing from src/providers or providers.")

  const providerSource = read(providerPath)
  if (!/['"]use client['"]/u.test(providerSource)) fail(`${providerPath} must be a client component.`)
  if (!/from\s*["']zustand["']/u.test(providerSource) || !/\buseStore\s*\(/u.test(providerSource)) {
    fail(`${providerPath} does not expose Zustand useStore selector access.`)
  }

  const layoutPath = firstExisting(appLayoutCandidates)
  const appPath = firstExisting(pagesAppCandidates)
  if (!layoutPath && !appPath) fail("Next.js entry is missing. Expected App Router layout or Pages Router _app.")

  const entryPath = layoutPath || appPath
  const entrySource = read(entryPath)
  if (!/<AppStoreProvider\b/u.test(entrySource)) {
    fail(`${entryPath} is not wrapped with AppStoreProvider.`)
  }

  const router = layoutPath ? "App Router" : "Pages Router"
  console.log(`zustand verification passed: Next.js ${router} dependency, store, provider, and entry wrapper are configured.`)
}

function main() {
  if (!exists("package.json")) fail("package.json is missing.")

  const manifest = readJson("package.json")
  const target = detectTarget(manifest)

  if (target === "next") verifyNext(manifest)
  else verifyReactVite(manifest)
}

main()
